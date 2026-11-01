"""Turns raw CLO3D garment exports into web-ready GLBs for the 3D Studio.

- splits each garment into named, independently editable parts
- simplifies stitch geometry (the tee ships ~960k stitch triangles)
- bakes ambient occlusion into vertex colours (COLOR_0), multiplied at runtime
- normalises to metres, centred on the origin, facing +Z; Draco-compressed

Run:
  Blender -b --factory-startup -P scripts/prepare_garments.py -- tee    <in.glb> public/models/tee.glb
  Blender -b --factory-startup -P scripts/prepare_garments.py -- pants  <in.glb> public/models/pants.glb
  (also: hoodie, zip, long)
"""
import sys
import time

import bmesh
import bpy
import mathutils
import mathutils.kdtree

kind, src, out = sys.argv[sys.argv.index("--") + 1 :][:3]
AO_SAMPLES = 48
AO_DISTANCE = 0.16  # metres
STITCH_RATIO = 0.45
STITCH_BUDGET = 150000  # triangles

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def bake_transforms():
    """Apply parent transforms by hand: mesh.transform keeps custom normals intact."""
    for o in meshes():
        o.data.transform(o.matrix_world)
    for o in meshes():
        o.parent = None
        o.matrix_world = mathutils.Matrix.Identity(4)
    for o in [o for o in bpy.data.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o)


def split_tee():
    src_obj = meshes()[0]
    me = src_obj.data
    names = ["front", "back", "sleeve_l", "sleeve_r", "collar", "stitching"]
    old_names = [m.name for m in me.materials]
    # Read per-face source materials first: clearing the slots resets polygon indices.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    me.materials.clear()
    for n in names:
        me.materials.append(bpy.data.materials.get(n) or bpy.data.materials.new(n))
    seen = set()
    counts = dict.fromkeys(names, 0)
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack, island = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        source = old_names[f0.material_index]
        cos = [v.co for f in island for v in f.verts]
        xs, ys, zs = [c.x for c in cos], [c.y for c in cos], [c.z for c in cos]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        if source.startswith("Rib"):
            part = "collar"
        elif source.startswith("Material"):
            part = "stitching"
        elif min(zs) > 1200 and abs(cx) > 150 and len(island) < 20000:
            part = "sleeve_l" if cx > 0 else "sleeve_r"
        elif len(island) >= 20000:
            part = "front" if min(ys) < -100 else "back"
        else:
            part = "front" if cy < 0 else "back"
        index = names.index(part)
        counts[part] += len(island)
        for f in island:
            f.material_index = index
    bm.to_mesh(me)
    bm.free()
    print("PARTS", counts)

    bpy.ops.object.select_all(action="DESELECT")
    src_obj.select_set(True)
    bpy.context.view_layer.objects.active = src_obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in meshes():
        n = o.data.materials[o.data.polygons[0].material_index].name
        o.name = n
        o.data.name = n

    # Each ~2 mm stitch carries ~100 near-coincident verts; merging them is what makes decimation work.
    stitch = bpy.data.objects["stitching"]
    bpy.ops.object.select_all(action="DESELECT")
    stitch.select_set(True)
    bpy.context.view_layer.objects.active = stitch
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.05)  # still in mm here
    bpy.ops.object.mode_set(mode="OBJECT")
    if "custom_normal" in stitch.data.attributes:
        stitch.data.attributes.remove(stitch.data.attributes["custom_normal"])
    mod = stitch.modifiers.new("d", "DECIMATE")
    mod.ratio = STITCH_RATIO
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("STITCH tris", len(stitch.data.polygons))


def split_pants():
    groups = {"front": [], "back": [], "pockets": [], "waistband": [], "loops": [], "hems": [], "button": []}
    for o in meshes():
        n = o.name
        if any(k in n for k in ("BK_5", "BK_6", "FRT_7", "FRT_9")):
            groups["hems"].append(o)
        elif "FLY" in n or "FRT" in n:
            groups["front"].append(o)
        elif "BK" in n:
            groups["back"].append(o)
        elif "PKT" in n:
            groups["pockets"].append(o)
        elif "154776" in n:
            groups["waistband"].append(o)
        elif "MatShape" in n:
            groups["button"].append(o)
        elif "Pattern2D" in n:
            groups["loops"].append(o)
        else:
            raise SystemExit(f"Unclassified piece: {n}")
    for name, objs in groups.items():
        join(objs, name)


def classify(kind, src, n, lo, hi):
    """Which editable part a connected pattern piece belongs to. Blender space, garment faces -Y."""
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    if kind == "hoodie":
        if "Rib_2X2" in src:
            if lo.z > 1.5:
                return "hood_trim"
            if abs(cx) > 0.6:
                return "cuffs"
            return "pocket" if lo.z > 0.45 else "hem"
        if abs(cx) > 0.37:
            return "sleeve_l" if cx > 0 else "sleeve_r"
        if lo.z > 1.5:
            return "hood"
        if lo.y < -0.55 and hi.z < 0.9 and hi.x - lo.x < 0.8:
            return "pocket"
        return "front" if cy < -0.4 else "back"
    if kind == "long":
        if "Material2868" in src:
            return "stitching"
        if hi.z < 0.96 and abs(cx) > 0.18:
            return "cuffs"
        if abs(cx) > 0.15:
            return "sleeve_l" if cx > 0 else "sleeve_r"
        if lo.z > 1.57:
            return "collar"
        if hi.z < 1.02:
            return "hem"
        if cy < -0.09 and hi.x - lo.x < 0.25 and hi.z < 1.3:
            return "pocket"
        return "front" if cy < -0.03 else "back"
    if kind == "zip":
        if src == "band":
            return "cuffs" if abs(cx) > 0.55 else "hem"
        if src == "Material.002":
            return "cords"
        if src in ("metal", "Material.003"):
            return "zipper"
        if src == "Material.001":
            return "stitching"
        if abs(cx) > 0.5:
            return "sleeve_l" if cx > 0 else "sleeve_r"
        if lo.z > 1.0:
            return "hood"
        if hi.z < 0.4 and hi.y < -0.17:
            return "pocket"
        return "back" if cy > 0 else "front"
    raise SystemExit(f"Unknown garment: {kind}")


def split_by_pieces(kind, parts):
    """Joins the whole file, then sorts every connected piece into a named part."""
    objs = meshes()
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    sources = [m.name for m in me.materials]
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    me.materials.clear()
    for name in parts:
        me.materials.append(bpy.data.materials.get(name) or bpy.data.materials.new(name))
    seen = set()
    counts = dict.fromkeys(parts, 0)
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack, island = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        cos = [v.co for f in island for v in f.verts]
        lo = mathutils.Vector(min(c[i] for c in cos) for i in range(3))
        hi = mathutils.Vector(max(c[i] for c in cos) for i in range(3))
        part = classify(kind, sources[min(f0.material_index, len(sources) - 1)], len(island), lo, hi)
        counts[part] += len(island)
        index = parts.index(part)
        for f in island:
            f.material_index = index
    bm.to_mesh(me)
    bm.free()
    print("PARTS", counts)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in meshes():
        n = o.data.materials[o.data.polygons[0].material_index].name
        o.name = n
        o.data.name = n
    if "stitching" in bpy.data.objects:
        stitch = bpy.data.objects["stitching"]
        bpy.ops.object.select_all(action="DESELECT")
        stitch.select_set(True)
        bpy.context.view_layer.objects.active = stitch
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.00005)
        bpy.ops.object.mode_set(mode="OBJECT")
        if "custom_normal" in stitch.data.attributes:
            stitch.data.attributes.remove(stitch.data.attributes["custom_normal"])
        mod = stitch.modifiers.new("d", "DECIMATE")
        mod.ratio = min(STITCH_RATIO, STITCH_BUDGET / max(1, len(stitch.data.polygons)))
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print("STITCH tris", len(stitch.data.polygons))


# Garments from assorted sources: name, height in metres, tops have sleeves.
GENERIC = {
    "shirt": (0.78, True), "shortshirt": (0.72, True), "polo": (0.72, True), "workjacket": (0.68, True),
    "varsity": (0.72, True), "blazer": (0.78, True), "vest": (0.68, False), "skirt": (0.52, False),
    "jeans": (1.05, False), "cargo": (1.02, False), "slimjeans": (1.03, False), "shorts": (0.5, False),
}
BOTTOMS = {"skirt", "jeans", "cargo", "slimjeans", "shorts"}
# Half-width of the torso in garment heights: beyond it a piece counts as sleeve.
SLEEVE_FROM = {"shirt": 0.25, "shortshirt": 0.29, "polo": 0.27, "workjacket": 0.27, "varsity": 0.29, "blazer": 0.25}
HAS_POCKETS = {"workjacket", "blazer", "vest", "slimjeans", "shorts"}  # elsewhere small pieces are just cut-up panels


def split_generic(kind):
    """Sorts pieces into parts by geometry alone, working in units of garment height. Huge pieces go face by face."""
    height, has_sleeves = GENERIC[kind]
    objs = meshes()
    for o in objs:
        if o.data.shape_keys:  # posing leftovers; they block decimation
            o.shape_key_clear()
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    cos = [v.co for v in me.vertices]
    lo = mathutils.Vector(min(c[i] for c in cos) for i in range(3))
    hi = mathutils.Vector(max(c[i] for c in cos) for i in range(3))
    H = hi.z - lo.z
    mid = (lo + hi) / 2
    depth = (hi.y - lo.y) / H
    width = (hi.x - lo.x) / H
    bottoms = kind in BOTTOMS
    parts = ["front", "back", "sleeve_l", "sleeve_r", "collar", "waistband", "pockets", "buttons", "stitching"]
    bm = bmesh.new()
    bm.from_mesh(me)
    sleeve_from = SLEEVE_FROM.get(kind, 9)

    # Cut along the seam lines first, so parts split face by face get a straight edge instead of a jagged one.
    planes = [(mathutils.Vector((mid.x, mid.y, mid.z)), mathutils.Vector((0, 1, 0)))]
    if has_sleeves:
        planes += [(mathutils.Vector((mid.x + side * sleeve_from * H, mid.y, mid.z)), mathutils.Vector((1, 0, 0))) for side in (-1, 1)]
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-7)
    bm.faces.ensure_lookup_table()
    me.materials.clear()
    for name in parts:
        me.materials.append(bpy.data.materials.get(name) or bpy.data.materials.new(name))

    def by_position(x, y, v):
        u = (x - mid.x) / H
        if has_sleeves and abs(u) > sleeve_from:
            return "sleeve_l" if u > 0 else "sleeve_r"
        return "front" if y < mid.y else "back"

    seen = set()
    total = len(bm.faces)
    counts = dict.fromkeys(parts, 0)
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack, island = [f0], []
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        pts = [v.co for f in island for v in f.verts]
        a = mathutils.Vector(min(c[i] for c in pts) for i in range(3))
        b = mathutils.Vector(max(c[i] for c in pts) for i in range(3))
        ext = (b - a) / H
        size = max(ext)
        c = (a + b) / 2
        v_lo, v_hi = (a.z - lo.z) / H, (b.z - lo.z) / H
        spans = ext.y > depth * 0.62 or ext.x > width * 0.72
        if size < 0.012:
            part = "stitching"
        elif size < 0.045 and abs(c.x - mid.x) / H < 0.09 and min(ext.x, ext.z) > size * 0.5 and not bottoms:
            part = "buttons"
        elif size < 0.045 and bottoms and kind != "skirt" and v_lo > 0.7 and min(ext.x, ext.z) > size * 0.5:
            part = "buttons"
        elif bottoms and v_lo > 0.9:
            part = "waistband"
        elif not bottoms and v_lo > 0.86 and has_sleeves and ext.z < 0.2:
            part = "collar"
        elif spans:
            part = None
        elif kind in HAS_POCKETS and size < 0.3 and not (has_sleeves and abs(c.x - mid.x) / H > sleeve_from):
            part = "pockets"
        else:
            part = by_position(c.x, c.y, v_lo)
        for f in island:
            if part:
                f.material_index = parts.index(part)
            else:
                m = f.calc_center_median()
                f.material_index = parts.index(by_position(m.x, m.y, (m.z - lo.z) / H))
            counts[parts[f.material_index]] += 1
    bm.to_mesh(me)
    bm.free()
    print("PARTS", {k: v for k, v in counts.items() if v}, "total", total)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in meshes():
        n = o.data.materials[o.data.polygons[0].material_index].name
        o.name = n
        o.data.name = n
    # A few stray fragments aren't stitching: thread settings would make them show as specks on the cloth.
    if "stitching" in bpy.data.objects and counts["stitching"] < total * 0.05:
        bpy.data.objects.remove(bpy.data.objects["stitching"])
        print("DROPPED stray fragments", counts["stitching"])
    if "stitching" in bpy.data.objects:
        stitch = bpy.data.objects["stitching"]
        bpy.ops.object.select_all(action="DESELECT")
        stitch.select_set(True)
        bpy.context.view_layer.objects.active = stitch
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.00005 * H / height)
        bpy.ops.object.mode_set(mode="OBJECT")
        if "custom_normal" in stitch.data.attributes:
            stitch.data.attributes.remove(stitch.data.attributes["custom_normal"])
        mod = stitch.modifiers.new("d", "DECIMATE")
        mod.ratio = min(STITCH_RATIO, STITCH_BUDGET / max(1, len(stitch.data.polygons)))
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Cloth budget: the web can't carry a million-triangle garment.
    for o in meshes():
        if o.name != "stitching" and len(o.data.polygons) > 120000:
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new("d", "DECIMATE")
            mod.ratio = 120000 / len(o.data.polygons)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return height / H


UV_METRES = 1.1
NON_CLOTH = {"stitching", "zipper", "cords", "button", "buttons"}


def rescale_uvs():
    """Source atlases range from 0.17 to 1.65 m per UV unit: make every piece 1.1 m, so weave density is real."""
    for o in meshes():
        if o.name in NON_CLOTH:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        uv = bm.loops.layers.uv.active
        bm.faces.ensure_lookup_table()
        seen = set()
        for f0 in bm.faces:
            if f0.index in seen:
                continue
            stack, island = [f0], []
            seen.add(f0.index)
            while stack:
                f = stack.pop()
                island.append(f)
                for e in f.edges:
                    for g in e.link_faces:
                        if g.index not in seen:
                            seen.add(g.index)
                            stack.append(g)
            area, uv_area = 0.0, 0.0
            for f in island:
                area += f.calc_area()
                ls = [l[uv].uv for l in f.loops]
                for i in range(1, len(ls) - 1):
                    uv_area += abs((ls[i] - ls[0]).cross(ls[i + 1] - ls[0])) / 2
            if uv_area < 1e-9:
                continue
            k = (area / uv_area) ** 0.5 / UV_METRES
            for f in island:
                for l in f.loops:
                    l[uv].uv = l[uv].uv * k
        bm.to_mesh(o.data)
        bm.free()


def normalise(scale):
    pts = [v.co * scale for o in meshes() for v in o.data.vertices]
    lo = mathutils.Vector(min(p[i] for p in pts) for i in range(3))
    hi = mathutils.Vector(max(p[i] for p in pts) for i in range(3))
    centre = (lo + hi) / 2
    matrix = mathutils.Matrix.Translation(-centre) @ mathutils.Matrix.Scale(scale, 4)
    for o in meshes():
        o.data.transform(matrix)
    print("SIZE", hi - lo)


def bake_ao():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = AO_SAMPLES
    scene.cycles.device = "CPU"
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.light_settings.distance = AO_DISTANCE
    scene.render.bake.target = "VERTEX_COLORS"
    scene.render.bake.margin = 0
    cloth = [o for o in meshes() if o.name != "stitching"]
    for o in cloth:
        t = time.time()
        attr = o.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        o.data.color_attributes.active_color = attr
        o.data.attributes.active_color = attr
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type="AO")
        values = [d.color[0] for d in attr.data]
        print("AO", o.name, "verts", len(values), "tris", len(o.data.polygons), "min", round(min(values), 3), "mean", round(sum(values) / len(values), 3), f"{time.time() - t:.0f}s")

    # Stitches sit buried in the cloth, so their own AO is near black: inherit it from the fabric.
    stitch = bpy.data.objects.get("stitching")
    if stitch:
        samples = [(v.co.copy(), o.data.color_attributes["Col"].data[v.index].color[0], v.normal.copy()) for o in cloth for v in o.data.vertices]
        tree = mathutils.kdtree.KDTree(len(samples))
        for i, (co, _, _) in enumerate(samples):
            tree.insert(co, i)
        tree.balance()
        attr = stitch.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        normals = []
        for v in stitch.data.vertices:
            # Brightest neighbour = the outer shell, not the lining underneath.
            best = max((samples[i] for _, i, _ in tree.find_n(v.co, 6)), key=lambda s: s[1])
            attr.data[v.index].color = (best[1], best[1], best[1], 1)
            normals.append(best[2])
        # Decimated stitches have broken normals and read as dark cracks: shade them like the cloth they lie on.
        stitch.data.normals_split_custom_set_from_vertices(normals)
        stitch.data.color_attributes.active_color = attr


def keep_one_material():
    """glTF only needs a placeholder: materials are created at runtime, per part."""
    shared = bpy.data.materials.new("cloth")
    for o in meshes():
        o.data.materials.clear()
        o.data.materials.append(shared)
        for p in o.data.polygons:
            p.material_index = 0


bake_transforms()
if kind == "tee":
    split_tee()
    normalise(0.001)
elif kind == "pants":
    split_pants()
    normalise(0.01)
elif kind == "hoodie":
    split_by_pieces(kind, ["front", "back", "sleeve_l", "sleeve_r", "hood", "hood_trim", "pocket", "cuffs", "hem"])
    normalise(0.33)
    rescale_uvs()
elif kind == "long":
    split_by_pieces(kind, ["front", "back", "sleeve_l", "sleeve_r", "collar", "pocket", "cuffs", "hem", "stitching"])
    normalise(1)
    rescale_uvs()
elif kind in GENERIC:
    scale = split_generic(kind)
    normalise(scale)
    rescale_uvs()
elif kind == "zip":
    split_by_pieces(kind, ["front", "back", "sleeve_l", "sleeve_r", "hood", "pocket", "cuffs", "hem", "zipper", "cords", "stitching"])
    normalise(0.33)
    rescale_uvs()
keep_one_material()
bake_ao()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_normals=True,
    export_texcoords=True,
    export_vertex_color="ACTIVE",
    export_materials="PLACEHOLDER",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
    export_draco_color_quantization=8,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)
for o in meshes():
    if o.name.startswith("sleeve_l"):
        # Numbers the catalogue's sleeve spec needs: axis, cuff reach.
        pts = sorted((v.co for v in o.data.vertices), key=lambda c: -c.z)
        top = sum((c for c in pts[: len(pts) // 8]), mathutils.Vector()) / (len(pts) // 8)
        low = sum((c for c in pts[-len(pts) // 8 :]), mathutils.Vector()) / (len(pts) // 8)
        axis = (low - top).normalized()
        print("SLEEVE axis", round(axis.x, 2), round(axis.z, 2), "len", round((low - top).length, 2), "x", round(min(c.x for c in pts), 3), round(max(c.x for c in pts), 3))
print("BOUNDS", {o.name: [round(min(v.co[i] for v in o.data.vertices), 3) for i in (0, 2)] + [round(max(v.co[i] for v in o.data.vertices), 3) for i in (0, 2)] for o in meshes() if o.name in ("front", "back", "pockets")})
print("DONE", out)
