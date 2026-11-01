"""Points the demo data at the rendered catalogue (public/catalog): images, 3D designs, names, descriptions, brand identity.
Run after generate_catalog.mjs:  python3 scripts/apply_catalog.py src/mock/data.json [path/to/backend/seed.json]"""
import json
import sys

index = json.load(open("public/catalog/index.json"))
LABEL = {"jersey": "cotton jersey", "heavy": "heavy jersey", "fleece": "brushed fleece", "waffle": "waffle knit", "twill": "cotton twill", "canvas": "canvas", "corduroy": "corduroy", "denim": "raw denim", "linen": "washed linen", "satin": "silk satin", "rib": "2x2 rib", "pique": "cotton pique", "leather": "nappa leather"}
FINISH = {"print": "screen print", "puff": "puff print", "embroidery": "embroidery", "foil": "metallic foil", "patch": "woven patch"}
specs = {p["id"]: p for p in index["products"]}


def images(pid):
    return [f"/catalog/{pid}-front.webp#bm3d=/catalog/designs/{pid}.json", f"/catalog/{pid}-three.webp", f"/catalog/{pid}-back.webp"]


def describe(spec, brand_description):
    techniques = sorted({FINISH[l["finish"]] for l in spec["layers"]})
    finish = f", {' and '.join(techniques)}" if techniques else ""
    return f"{brand_description} Designed in 3D Studio: {LABEL[spec['fabric']]}{finish}."[:2000]


def walk(node, fn):
    if isinstance(node, dict):
        fn(node)
        for k, v in list(node.items()):
            if isinstance(v, str):
                node[k] = STR.get(v, v)
            else:
                walk(v, fn)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            if isinstance(v, str):
                node[i] = STR.get(v, v)
            else:
                walk(v, fn)


data = json.load(open(sys.argv[1]))
STR = {}
old = {}
brand_desc = {b["slug"]: b["description"] for b in data["brands"]}
for p in data["products"]:
    spec = specs[p["id"]]
    old[p["id"]] = p["name"]
    STR[p["images"][0]] = f"/catalog/{p['id']}-front.webp"
    STR[p["images"][1]] = f"/catalog/{p['id']}-three.webp"
first_product = {}
for spec in index["products"]:
    first_product.setdefault(spec["brand"], spec["id"])
for b in data["brands"]:
    STR[b["logo"]] = f"/catalog/brands/{b['slug']}.svg"
    if b.get("banner"):
        STR[b["banner"]] = f"/catalog/brands/{b['slug']}-banner.webp"
    if b.get("cover"):
        STR[b["cover"]] = f"/catalog/{first_product[b['slug']]}-front.webp"
names = {}
for pid, name in old.items():
    names.setdefault(name, []).append(pid)


def fix(o):
    slug = o.get("slug")
    if slug in first_product:  # set per brand: several brands share one stock banner, so a URL map can't do this
        if o.get("logo"):
            o["logo"] = f"/catalog/brands/{slug}.svg"
        if o.get("banner"):
            o["banner"] = f"/catalog/brands/{slug}-banner.webp"
        if o.get("cover"):
            o["cover"] = f"/catalog/{first_product[slug]}-front.webp"
    pid = o.get("id")
    if pid in specs and o.get("name") == old.get(pid):
        spec = specs[pid]
        o["name"] = spec["name"]
        if "images" in o:
            o["images"] = images(pid)
            o["colors"] = [spec["color"]]
            o["videoUrl"] = None
            o["description"] = describe(spec, brand_desc[spec["brand"]])


walk(data, fix)

# Products for the newer garment models: cloned from a template so every API shape stays valid.
template = data["products"][0]
minis = {b["slug"]: b for b in data["brands"]}
known = {p["id"] for p in data["products"]}
added = []
for spec in index["products"]:
    if spec["id"] in known:
        continue
    pid, b = spec["id"], minis[spec["brand"]]
    seed_n = pid * 7919
    p = json.loads(json.dumps(template))
    p.update(id=pid, name=spec["name"], price=float(spec["price"]), type=spec["type"], images=images(pid), colors=[spec["color"]], videoUrl=None, description=describe(spec, b["description"]), stock=8 + pid % 9, inStock=True, views=200 + seed_n % 2600, sales=seed_n % 41, likes=seed_n % 73, comments=0, reviews=0, rating=None, saves=0, badges=["NEW"], createdAt="2026-10-30T12:00:00", sizes=["S", "M", "L", "XL"], brand={k: b[k] for k in ("id", "slug", "name", "logo", "style", "verified", "winner")})
    added.append(p)
    data["reviews"][str(pid)] = {"average": None, "count": 0, "histogram": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}, "canReview": False, "reviewed": False, "items": []}
    data["comments"][str(pid)] = []
    data["related"][str(pid)] = [x["id"] for x in data["products"] if x["type"] == spec["type"]][:8] or [x["id"] for x in data["products"] if x["brand"]["slug"] == spec["brand"]][:8]
    b["productsCount"] += 1
# Interleave so new styles appear throughout the shop and the feed.
merged, feed = [], []
old_feed = list(data["feedOrder"])
new_ids = [p["id"] for p in added]
step = max(1, len(data["products"]) // max(1, len(added)))
pool = list(added)
for i, p in enumerate(data["products"]):
    merged.append(p)
    if i % step == 0 and pool:
        merged.append(pool.pop(0))
merged += pool
data["products"] = merged
pool = list(new_ids)
for i, x in enumerate(old_feed):
    feed.append(x)
    if i % step == 0 and pool:
        feed.append(pool.pop(0))
data["feedOrder"] = feed + pool
data["home"]["fresh"] = added[:12] + data["home"]["fresh"]
data["home"]["productsCount"] = len(merged)
data["facets"]["types"] = sorted(set(data["facets"]["types"]) | {p["type"] for p in added})
data["facets"]["minPrice"] = min(data["facets"]["minPrice"], *(p["price"] for p in added))
data["facets"]["maxPrice"] = max(data["facets"]["maxPrice"], *(p["price"] for p in added))
for e in data.get("events", []):
    if e.get("cover") and e["cover"].startswith("http"):
        e["cover"] = "/catalog/brands/airu-banner.webp"
text = json.dumps(data, ensure_ascii=False)
for name, ids in names.items():  # order and notification text; ambiguous duplicates keep the brand's first new name
    text = text.replace(name, specs[ids[0]]["name"]) if name != specs[ids[0]]["name"] else text
json.dump(json.loads(text), open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))

if len(sys.argv) > 2:
    seed = json.load(open(sys.argv[2]))
    by_key = {(old[s["id"]], next(p["price"] for p in data["products"] if p["id"] == s["id"])): s for s in index["products"] if s["id"] in old}
    missed = 0
    slugs = {b["name"]: b["slug"] for b in data["brands"]}
    for b in seed["brands"]:
        slug = slugs[b["name"]]
        b["owner"]["avatar"] = f"/catalog/brands/{slug}.svg"
        for key in ("logo", "banner"):
            if key in b:
                b[key] = f"/catalog/brands/{slug}.svg" if key == "logo" else f"/catalog/brands/{slug}-banner.webp"
        if "banner" in b["owner"]:
            b["owner"]["banner"] = f"/catalog/brands/{slug}-banner.webp"
        for p in b["products"]:
            spec = by_key.get((p["name"], float(p["price"])))
            if not spec:
                missed += 1
                continue
            # seed.json keeps colors as a comma-separated string
            p.update(name=spec["name"], images=images(spec["id"]), colors=spec["color"], video=None, description=describe(spec, b["description"]))
    print("seed products unmatched:", missed)
    by_slug = {slugs[b["name"]]: b for b in seed["brands"]}
    for p in added:
        spec = specs[p["id"]]
        by_slug[spec["brand"]]["products"].append({"name": spec["name"], "description": p["description"], "price": float(spec["price"]), "images": images(p["id"]), "video": None, "type": spec["type"], "sizes": "S,M,L,XL", "colors": spec["color"], "stockStatus": "IN_STOCK", "stock": p["stock"], "views": p["views"], "sales": p["sales"]})
    json.dump(seed, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
