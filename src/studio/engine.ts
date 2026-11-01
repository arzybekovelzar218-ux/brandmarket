/* The 3D viewport. Artwork is projected per-fragment from object space, so it follows every wrinkle
   and crosses seams without touching the mesh. */
import {
  Box3, CanvasTexture, Color, DataArrayTexture, DirectionalLight, DoubleSide, Group, HemisphereLight, LinearFilter, LinearMipmapLinearFilter,
  Matrix3, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, NeutralToneMapping, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Raycaster,
  RepeatWrapping, RGBAFormat, Scene, SRGBColorSpace, type BufferAttribute, type BufferGeometry, type Texture, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderer, BoxGeometry,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh'
import { backdropStops, type Design, fabricById, FINISHES, GARMENTS, type GarmentId, HARDWARE, type Layer, type PartStyle, type Placement } from './catalog'
import { drawPattern, fabricMaps, LAYER_SIZE, loadImage, rasterKey, rasterLayer, UV_METRES } from './textures'

const MAX_LAYERS = 8
const WHITE = new Color(0xffffff)
const BASE = import.meta.env.BASE_URL

export type Light = 'studio' | 'daylight' | 'noir'
/** How a garment moves on the runway. */
export type Motion = 'still' | 'spin' | 'sway' | 'float'
export type View = 'front' | 'three' | 'side' | 'sideR' | 'back'
const VIEW_ANGLE: Record<View, number> = { front: 0, three: Math.PI * 0.2, side: Math.PI / 2, sideR: -Math.PI / 2, back: Math.PI }

export interface Overlay { visible: boolean; scale: [number, number]; rotate: [number, number]; center: [number, number] }
export interface EngineEvents {
  onPick(target: { type: 'part' | 'layer'; id: string } | null): void
  onMoveLayer(id: string, p: [number, number, number], n: [number, number, number]): void
  onMoveEnd(): void
  onOverlay(o: Overlay | null): void
  onLoading(loading: boolean): void
  onOrbit(): void
  onError(message: string): void
}

const shared = {
  uDecals: { value: null as DataArrayTexture | null },
  uDecalM: { value: Array.from({ length: MAX_LAYERS }, () => new Matrix4()) },
  uDecalDir: { value: Array.from({ length: MAX_LAYERS }, () => new Vector3()) },
  uDecalP: { value: Array.from({ length: MAX_LAYERS }, () => new Vector4()) },
  uDecalN: { value: 0 },
  uSel: { value: -1 },
  uCutY: { value: -99 },
  uSleeveD: { value: 99 },
  uSleeveN: { value: new Vector3(1, 0, 0) },
  uSleeveMin: { value: new Vector2(0, 0) },
}

const PARS = /* glsl */ `
varying vec3 vOP; varying vec3 vON; varying vec2 vRawUv;
uniform highp sampler2DArray uDecals;
uniform mat4 uDecalM[${MAX_LAYERS}]; uniform vec3 uDecalDir[${MAX_LAYERS}]; uniform vec4 uDecalP[${MAX_LAYERS}];
uniform int uDecalN; uniform int uSel;
uniform float uCutY; uniform float uSleeveD; uniform vec3 uSleeveN; uniform vec2 uSleeveMin; uniform float uCutRole;
uniform sampler2D uFabric; uniform vec2 uFabricRepeat;
uniform sampler2D uPat; uniform float uPatOn; uniform mat3 uPatM; uniform float uAoFloor; uniform float uIsThread;
float bmHeight = 0.; float bmCover = 0.; float bmRough = 1.; float bmMetal = 0.; float bmOutline = 0.; float bmFlat = 0.;
`

const SURFACE = /* glsl */ `
#include <map_fragment>
// Role 1 = sleeve piece, 2 = stitching (one mesh, so split by position), 0 = body. Length never cuts a hanging sleeve.
bool onSleeve = uCutRole > .5 && (uCutRole < 1.5 || (abs(vOP.x) > uSleeveMin.x && vOP.y > uSleeveMin.y));
float cutDist = onSleeve ? uSleeveD - dot(vec3(abs(vOP.x), vOP.y, vOP.z), uSleeveN) : vOP.y - uCutY;
float cutCover = clamp(cutDist / max(fwidth(cutDist), 1e-5) + .5, 0., 1.);
if (cutCover <= 0.) discard;
diffuseColor.a = cutCover;
if (uPatOn > .5) diffuseColor.rgb = texture2D(uPat, (uPatM * vec3(vRawUv, 1.)).xy).rgb;
vec4 tile = texture2D(uFabric, vRawUv * uFabricRepeat);
diffuseColor.rgb = diffuseColor.rgb * tile.r + vec3(tile.g * .5);
// Finished hem at a shortened edge: a stitch line 2 cm up and a tight fold at the edge.
float hemLine = smoothstep(.0172, .0182, cutDist) * (1. - smoothstep(.0192, .0202, cutDist));
float hemFold = 1. - smoothstep(.0, .002, cutDist);
diffuseColor.rgb *= 1. - .32 * hemLine - .3 * hemFold;

if (gl_FrontFacing) {
  vec3 objN = normalize(vON);
  for (int i = 0; i < uDecalN; i++) {
    vec4 q = uDecalM[i] * vec4(vOP, 1.);
    // Taken before the box test: q is continuous here, so the edge can't pick a coarse mip.
    vec2 gx = dFdx(q.xy); vec2 gy = dFdy(q.xy);
    if (abs(q.x) > .5 || abs(q.y) > .5 || abs(q.z) > .5) continue;
    float face = smoothstep(.02, .3, dot(objN, uDecalDir[i]));
    if (face <= 0.) continue;
    vec4 P = uDecalP[i];
    vec2 duv = q.xy + .5;
    float layer = P.w;
    vec4 tex = textureGrad(uDecals, vec3(duv, layer), gx, gy);
    if (i == uSel) {
      vec2 w = abs(gx) + abs(gy);
      vec2 edge = (.5 - abs(q.xy)) / max(w, vec2(1e-5));
      float dash = step(0., sin((q.x + q.y) * 60.));
      bmOutline = max(bmOutline, (1. - smoothstep(1.2, 2.2, min(edge.x, edge.y))) * mix(.35, 1., dash));
    }
    // Fade to nothing in the last two pixels of the box: border texels must never read as a line.
    vec2 boxPx = (.5 - abs(q.xy)) / max(abs(gx) + abs(gy), vec2(1e-5));
    float a = tex.a * P.x * face * smoothstep(0., 2., min(boxPx.x, boxPx.y));
    if (a <= .001) continue;
    vec3 rgb = pow(tex.rgb / max(tex.a, .004), vec3(2.2));
    float soft = textureLod(uDecals, vec3(duv, layer), 3.).a;
    float h = a; float rough = .62; float metal = 0.; float flatten = .55;
    int finish = int(P.y + .5);
    if (finish == 1) { h = soft * soft * 2.6; rough = .82; flatten = .9; rgb *= .94 + .06 * soft; }           // puff
    else if (finish == 2) {                                                                     // embroidery
      float t = sin((q.x * .92 + q.y * .38) * P.z * 2100.) * .5 + .5;
      h = (soft * .9 + t * .75) * a; rough = .42; flatten = .95; rgb *= .76 + .3 * t;
    }
    else if (finish == 3) { h = a * .2; rough = .24; metal = 1.; flatten = .92; rgb = rgb * 1.25; }            // foil
    else if (finish == 4) {                                                                     // patch
      float t = sin(q.x * P.z * 1500.) * sin(q.y * P.z * 1500.);
      h = soft * 1.3 + t * .22; rough = .9; flatten = 1.; rgb *= .9 + .1 * t;
    }
    else h = a * .12;                                                                           // screen print
    diffuseColor.rgb = mix(diffuseColor.rgb, rgb, a);
    bmHeight = max(bmHeight, h * face);
    bmCover = max(bmCover, a);
    bmFlat = mix(bmFlat, flatten, a);
    bmRough = mix(bmRough, rough, a);
    bmMetal = mix(bmMetal, metal, a);
  }
}
`

const AO_COLOR = /* glsl */ `
#ifdef USE_COLOR
  float bmAo = pow(vColor.r, .85);
  diffuseColor.rgb *= mix(uAoFloor, 1., bmAo);
#else
  float bmAo = 1.;
#endif
`

const FINISH_PBR = /* glsl */ `
#include <metalnessmap_fragment>
roughnessFactor = mix(roughnessFactor, bmRough, bmCover);
metalnessFactor = mix(metalnessFactor, bmMetal, bmCover);
`

const BUMP = /* glsl */ `
#include <normal_fragment_maps>
// Decimated stitches have mixed winding: never flip their normal for "back" faces, or they render as dark cracks.
if (uIsThread > .5) normal = normalize(vNormal);
if (bmCover > .001) {
  normal = normalize(mix(normal, nonPerturbedNormal, bmFlat * bmCover));
  vec3 sx = dFdx(-vViewPosition); vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal); vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1);
  float hx = dFdx(bmHeight) * .0016; float hy = dFdy(bmHeight) * .0016;
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  normal = normalize(abs(det) * normal - grad);
}
`

function buildCloth(cutRole: number, aoFloor: number, isThread: boolean) {
  const uniforms = {
    uFabric: { value: null as Texture | null },
    uFabricRepeat: { value: new Vector2(1, 1) },
    uPat: { value: null as Texture | null },
    uPatOn: { value: 0 },
    uPatM: { value: new Matrix3() },
    uCutRole: { value: cutRole },
    uAoFloor: { value: aoFloor },
    uIsThread: { value: isThread ? 1 : 0 },
  }
  const m = new MeshPhysicalMaterial({ side: DoubleSide, vertexColors: true, alphaToCoverage: true })
  m.shadowSide = DoubleSide
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared, uniforms)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vOP; varying vec3 vON; varying vec2 vRawUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvOP = position; vON = normal; vRawUv = uv;`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', SURFACE)
      .replace('#include <color_fragment>', AO_COLOR)
      .replace('#include <metalnessmap_fragment>', FINISH_PBR)
      .replace('#include <normal_fragment_maps>', BUMP)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.95, .72, .24) * bmOutline;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\nreflectedLight.indirectSpecular *= mix(.3, 1., bmAo); reflectedLight.directDiffuse *= mix(.55, 1., bmAo);`)
  }
  return { material: m, uniforms }
}

type Part = { mesh: Mesh<BufferGeometry, MeshPhysicalMaterial>; uniforms: ReturnType<typeof buildCloth>['uniforms']; key: string; patKey: string }
type Slot = { id: string; key: string; aspect: number; loading: boolean }

export class StudioEngine {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(26, 1, 0.05, 20)
  private controls: OrbitControls
  private root = new Group()
  private shadow: Mesh<PlaneGeometry, MeshBasicMaterial>
  private key = new DirectionalLight(0xffffff, 1.5)
  private hemi = new HemisphereLight(0xffffff, 0x6f675b, 0.2)
  private pmrem: PMREMGenerator
  private env: Partial<Record<Light, Texture>> = {}
  private loader: GLTFLoader
  private draco: DRACOLoader
  private garments = new Map<GarmentId, Map<string, Part>>()
  private groups = new Map<GarmentId, Group>()
  private active: GarmentId | null = null
  private parts = new Map<string, Part>()
  private slots: (Slot | null)[] = Array(MAX_LAYERS).fill(null)
  private decals: DataArrayTexture
  private ray = new Raycaster()
  private ndc = new Vector2()
  private dirty = true
  private raf = 0
  private tween: { from: number; to: number; start: number; polarFrom: number } | null = null
  private drag: { id: string; moved: boolean } | null = null
  private press: { x: number; y: number; layer: string | null } | null = null
  private hovered: string | null = null
  private selectedLayer: string | null = null
  private design: Design | null = null
  private rhythm: (() => number) | null = null
  private motion: Motion = 'still'
  private motionHold = 0
  private motionAt = 0
  private insets: (() => { top: number; bottom: number; x: number }) | null = null
  private startView: View = 'three'
  private keyBase = 1.25
  private ro: ResizeObserver
  private center = new Vector3()
  private size = new Vector3(0.7, 0.7, 0.3)
  private sleeveCentreZ = 0
  private sleeveMax = 0
  private bottomY = 0
  private disposed = false
  private events: EngineEvents
  private host: HTMLElement
  private interactive: boolean
  private pendingLoad: Promise<void> | null = null
  private loadingFor: GarmentId | null = null

  constructor(host: HTMLElement, events: EngineEvents, options: { interactive?: boolean } = {}) {
    this.host = host
    this.interactive = options.interactive ?? true
    this.events = events
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.outputColorSpace = SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.setAttribute('aria-label', '3D garment viewport')
    host.appendChild(renderer.domElement)

    this.decals = new DataArrayTexture(new Uint8Array(LAYER_SIZE * LAYER_SIZE * 4 * MAX_LAYERS), LAYER_SIZE, LAYER_SIZE, MAX_LAYERS)
    this.decals.format = RGBAFormat
    this.decals.type = UnsignedByteType
    this.decals.minFilter = LinearMipmapLinearFilter
    this.decals.magFilter = LinearFilter
    this.decals.generateMipmaps = true
    this.decals.anisotropy = 4
    this.decals.needsUpdate = true
    shared.uDecals.value = this.decals

    this.scene.add(this.root, this.hemi)
    this.key.position.set(0.9, 1.5, 1.8)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.radius = 7
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.006
    const sc = this.key.shadow.camera
    sc.left = sc.bottom = -0.7
    sc.right = sc.top = 0.7
    sc.near = 0.2
    sc.far = 5
    this.scene.add(this.key, this.key.target)

    this.shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }))
    this.shadow.rotation.x = -Math.PI / 2
    this.scene.add(this.shadow)

    this.pmrem = new PMREMGenerator(renderer)
    this.setLight('studio')

    this.controls = new OrbitControls(this.camera, renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.75
    this.controls.minPolarAngle = Math.PI * 0.2
    this.controls.maxPolarAngle = Math.PI * 0.72
    this.controls.addEventListener('change', () => (this.dirty = true))
    this.controls.addEventListener('start', () => {
      this.motionHold = performance.now() + 3500 // let the viewer look, then resume
      this.events.onOrbit()
    })

    this.draco = new DRACOLoader().setDecoderPath(`${BASE}draco/`)
    this.loader = new GLTFLoader().setDRACOLoader(this.draco)

    const el = renderer.domElement
    if (this.interactive) {
      el.addEventListener('pointerdown', this.onDown)
      el.addEventListener('pointermove', this.onMove)
      el.addEventListener('pointerleave', this.onLeave)
      window.addEventListener('pointerup', this.onUp)
    }

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.loop()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerleave', this.onLeave)
    window.removeEventListener('pointerup', this.onUp)
    this.controls.dispose()
    this.draco.dispose()
    this.decals.dispose()
    this.pmrem.dispose()
    for (const parts of this.garments.values()) {
      for (const p of parts.values()) {
        p.mesh.geometry.dispose()
        p.mesh.material.dispose()
        p.uniforms.uPat.value?.dispose()
      }
    }
    Object.values(this.env).forEach((t) => t?.dispose())
    this.renderer.dispose()
    this.renderer.forceContextLoss() // browsers cap live WebGL contexts; shoppers open many products
    el.remove()
  }

  private resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, true)
    this.camera.aspect = w / h
    if (this.insets) {
      const inset = this.insets()
      this.camera.setViewOffset(w, h, -inset.x * w, (inset.bottom - inset.top) / 2, w, h)
    }
    this.camera.updateProjectionMatrix()
    this.frame(false)
    this.dirty = true
  }

  private frameDistance() {
    const base = this.fitDistance(this.camera, 0.1, 0.08) * 1.2
    if (!this.insets) return base
    // Keep the garment inside the free part of the stage.
    const { top, bottom } = this.insets()
    const h = Math.max(1, this.host.clientHeight)
    return base * Math.max(1, h / Math.max(h * 0.25, h - top - bottom))
  }

  /** Distance at which the whole garment, plus margins in metres, fits this camera. */
  private fitDistance(camera: PerspectiveCamera, marginY: number, marginX: number) {
    const v = camera.fov * (Math.PI / 180)
    return Math.max((this.size.y + marginY) / (2 * Math.tan(v / 2)), (this.size.x + marginX) / (2 * Math.tan(v / 2) * camera.aspect))
  }

  /** Keeps the current angle, resets distance so the garment always fits. */
  private frame(resetAngle: boolean) {
    const d = this.frameDistance()
    const offset = this.camera.position.clone().sub(this.controls?.target ?? this.center)
    if (resetAngle || offset.lengthSq() < 1e-6) offset.set(Math.sin(VIEW_ANGLE[this.startView]) * 0.8, 0.06, Math.cos(VIEW_ANGLE[this.startView]) * 0.8)
    offset.setLength(d)
    this.camera.position.copy(this.center).add(offset)
    if (this.controls) {
      this.controls.target.copy(this.center)
      this.controls.minDistance = d * 0.28
      this.controls.maxDistance = d * 1.45
      this.controls.update()
    }
  }

  setView(view: View) {
    const offset = this.camera.position.clone().sub(this.controls.target)
    const az = Math.atan2(offset.x, offset.z)
    let to = VIEW_ANGLE[view]
    while (to - az > Math.PI) to -= Math.PI * 2
    while (to - az < -Math.PI) to += Math.PI * 2
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.placeCamera(to, Math.PI / 2 - 0.05)
      return
    }
    this.tween = { from: az, to, start: performance.now(), polarFrom: Math.acos(offset.y / offset.length()) }
  }

  private placeCamera(az: number, polar: number, dist = this.camera.position.distanceTo(this.controls.target)) {
    const t = this.controls.target
    this.camera.position.set(t.x + dist * Math.sin(polar) * Math.sin(az), t.y + dist * Math.cos(polar), t.z + dist * Math.sin(polar) * Math.cos(az))
    this.camera.lookAt(t)
    this.dirty = true
  }

  /** Moves the canvas into another element: one engine serves every slide of the feed. */
  attach(host: HTMLElement) {
    if (host === this.host) return
    this.ro.unobserve(this.host)
    this.host = host
    host.appendChild(this.renderer.domElement)
    this.ro.observe(host)
    this.resize()
  }

  /** Runway mode: the garment moves by itself, and `rhythm` (0..1, per beat) makes it pulse with the music. */
  setRunway(rhythm: () => number, insets: () => { top: number; bottom: number; x: number }) {
    this.rhythm = rhythm
    this.insets = insets
    this.startView = 'front'
    this.resize()
  }

  setMotion(motion: Motion) {
    this.motion = motion
    this.motionHold = 0
    this.root.rotation.y = motion === 'spin' ? -0.7 : 0
    this.root.position.y = 0
    this.dirty = true
  }

  private applyMotion(now: number) {
    const dt = Math.min(0.05, (now - this.motionAt) / 1000)
    this.motionAt = now
    const beat = this.rhythm!()
    const s = 1 + 0.02 * beat
    const d = this.design
    this.root.scale.set((d?.fit ?? 1) * s, s, (d?.depth ?? 1) * s)
    this.key.intensity = this.keyBase * (1 + 0.28 * beat)
    if (now > this.motionHold) {
      const t = now / 1000
      if (this.motion === 'spin') this.root.rotation.y += dt * (0.42 + beat * 0.9)
      else if (this.motion === 'sway') this.root.rotation.y = Math.sin(t * 0.8) * 0.5
      else if (this.motion === 'float') {
        this.root.rotation.y = Math.sin(t * 0.5) * 0.28
        this.root.position.y = Math.sin(t * 1.3) * 0.012
      }
    }
    this.dirty = true
  }

  /** Inside a scrolling page: wheel and vertical swipes must keep scrolling the page. */
  setEmbedded(embedded: boolean) {
    this.controls.enableZoom = !embedded
    this.renderer.domElement.style.touchAction = embedded ? 'pan-y' : 'none'
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on
    this.controls.autoRotateSpeed = 1.6
  }

  setLight(light: Light) {
    if (!this.env[light]) this.env[light] = this.pmrem.fromScene(buildEnv(light), 0.03).texture
    this.scene.environment = this.env[light]!
    const cfg = { studio: [0.72, 1.25, 0xfffbf6, 0.42], daylight: [0.8, 1.7, 0xfff0d8, 0.3], noir: [0.42, 2.2, 0xffffff, 0.65] }[light]
    this.scene.environmentIntensity = cfg[0]
    this.key.intensity = cfg[1]
    this.keyBase = cfg[1]
    this.key.color.setHex(cfg[2])
    this.shadow.material.opacity = cfg[3]
    this.dirty = true
  }

  /* ── Garment loading ─────────────────────────────────────────── */
  private async load(id: GarmentId): Promise<void> {
    if (this.garments.has(id)) return
    const def = GARMENTS[id]
    const gltf = await this.loader.loadAsync(`${BASE}${def.file}`)
    const parts = new Map<string, Part>()
    const group = new Group()
    const box = new Box3()
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh<BufferGeometry>
      if (!mesh.isMesh) return
      const pid = (mesh.name || mesh.parent?.name || '').replace(/_\d+$/, '')
      const partDef = def.parts.find((p) => p.id === pid)
      if (!partDef) return
      const cutRole = !def.sleeve ? 0 : def.sleeve.parts.includes(pid) ? 1 : pid === 'stitching' ? 2 : 0
      const { material, uniforms } = buildCloth(cutRole, partDef.kind === 'thread' ? 0.9 : 0.32, partDef.kind === 'thread')
      const geometry = mesh.geometry
      geometry.applyMatrix4(mesh.matrixWorld)
      const m = new Mesh(geometry, material)
      m.name = pid
      m.castShadow = partDef.kind === 'cloth'
      m.receiveShadow = partDef.kind !== 'thread'
      group.add(m)
      parts.set(pid, { mesh: m, uniforms, key: '', patKey: '' })
      geometry.computeBoundingBox()
      box.union(geometry.boundingBox!)
    })
    group.userData.box = box
    if (parts.size !== def.parts.length) console.warn(`[studio] ${id}: expected ${def.parts.length} parts, found ${parts.size}`)
    this.garments.set(id, parts)
    this.groups.set(id, group)
    if (this.disposed) return
    // Upload programs and meshes up front so the first drag isn't a hitch.
    this.root.add(group)
    group.visible = false
  }

  private show(id: GarmentId) {
    if (this.active === id) return
    const group = this.groups.get(id)!
    for (const g of this.groups.values()) g.visible = g === group
    this.active = id
    this.parts = this.garments.get(id)!
    const box = group.userData.box as Box3
    this.center.set(0, (box.min.y + box.max.y) / 2, 0)
    box.getSize(this.size)
    this.bottomY = box.min.y
    this.shadow.position.set(0, box.min.y - 0.045, 0)
    const width = box.max.x - box.min.x
    this.shadow.scale.set(width * 1.25, 0.42, 1)
    this.key.target.position.copy(this.center)
    const spec = GARMENTS[id].sleeve
    const sleeve = this.parts.get('sleeve_l')
    if (spec && sleeve) {
      shared.uSleeveN.value.set(spec.axis[0], spec.axis[1], 0).normalize()
      shared.uSleeveMin.value.set(spec.minX, spec.minY)
      const pos = sleeve.mesh.geometry.getAttribute('position') as BufferAttribute
      let max = -Infinity
      for (let i = 0; i < pos.count; i += 3) max = Math.max(max, pos.getX(i) * shared.uSleeveN.value.x + pos.getY(i) * shared.uSleeveN.value.y)
      this.sleeveMax = max
      const bounds = sleeve.mesh.geometry.boundingBox!
      this.sleeveCentreZ = (bounds.min.z + bounds.max.z) / 2
    }
    this.frame(true)
    this.setView(this.startView)
    this.tween = null
    this.controls.update()
    this.dirty = true
  }

  /* ── Sync with the design ────────────────────────────────────── */
  apply(design: Design, selectedLayer: string | null) {
    this.design = design
    this.selectedLayer = selectedLayer
    if (this.active !== design.garment) {
      if (this.loadingFor === design.garment && this.pendingLoad) return
      this.loadingFor = design.garment
      this.events.onLoading(true)
      this.pendingLoad = this.load(design.garment)
        .then(() => {
          if (this.disposed || this.design?.garment !== design.garment) return
          this.show(design.garment)
          this.sync()
          this.events.onLoading(false)
        })
        .catch((e) => {
          console.error(e)
          this.events.onLoading(false)
          this.events.onError('Could not load the 3D model')
        })
        .finally(() => {
          this.pendingLoad = null
          this.loadingFor = null
          if (this.design && this.design.garment !== this.active && !this.disposed) this.apply(this.design, this.selectedLayer)
        })
      return
    }
    this.sync()
  }

  private sync() {
    const d = this.design
    if (!d || d.garment !== this.active) return
    const def = GARMENTS[d.garment]
    for (const pd of def.parts) {
      const part = this.parts.get(pd.id)
      if (part && d.parts[pd.id]) this.applyPart(part, d.parts[pd.id], pd.kind)
    }
    this.root.scale.set(d.fit, 1, d.depth)
    shared.uCutY.value = d.length >= 0.999 ? -99 : def.cropY + (this.bottomY - def.cropY) * d.length
    shared.uSleeveD.value = d.sleeve >= 0.999 || !def.sleeve ? 99 : this.sleeveMax - def.sleeve.travel * (1 - d.sleeve)
    this.shadow.position.y = Math.max(this.bottomY, shared.uCutY.value) - 0.045
    void this.syncLayers(d)
    this.dirty = true
  }

  private applyPart(part: Part, s: PartStyle, kind: string) {
    const m = part.mesh.material
    m.color.set(s.color)
    m.sheenColor.copy(m.color).lerp(WHITE, 0.18)
    // Decimated stitches have noisy normals; a little self-glow keeps pale thread from reading as dark specks.
    if (kind === 'thread') m.emissive.copy(m.color).multiplyScalar(0.28)
    const key = `${s.fabric}|${s.hardware}|${kind}`
    if (part.key !== key) {
      part.key = key
      if (kind === 'cloth') {
        const f = fabricById(s.fabric)
        const maps = fabricMaps(s.fabric)
        m.normalMap = maps.normal
        m.normalScale.setScalar(f.normal)
        m.roughnessMap = maps.roughness
        m.roughness = f.roughness / 0.92
        m.metalness = 0
        m.sheen = f.sheen
        m.sheenRoughness = f.sheenRoughness
        part.uniforms.uFabric.value = maps.albedo
        part.uniforms.uFabricRepeat.value.setScalar(UV_METRES / f.tile)
      } else {
        const hw = HARDWARE.find((h) => h.id === s.hardware)
        const neutral = fabricMaps('satin')
        part.uniforms.uFabric.value = neutral.albedo
        part.uniforms.uFabricRepeat.value.setScalar(1)
        m.normalMap = null
        m.roughnessMap = null
        m.roughness = hw?.roughness ?? 0.7
        m.metalness = hw?.metalness ?? 0
        m.sheen = kind === 'thread' ? 0.4 : 0
      }
      m.needsUpdate = true
    }
    const p = s.pattern
    const patKey = p.kind === 'solid' ? '' : [p.kind, p.color, s.color, p.image?.length, p.image?.slice(-32)].join('|')
    if (part.patKey !== patKey) {
      part.patKey = patKey
      part.uniforms.uPat.value?.dispose()
      part.uniforms.uPat.value = null
      part.uniforms.uPatOn.value = 0
      if (p.kind === 'image' && p.image) {
        void loadImage(p.image).then((img) => {
          if (part.patKey === patKey) this.setPattern(part, drawPattern(p, s.color, img))
        })
      } else if (patKey && p.kind !== 'image') this.setPattern(part, drawPattern(p, s.color, null))
    }
    const scale = UV_METRES / Math.max(0.01, p.scale)
    const a = (p.angle * Math.PI) / 180
    part.uniforms.uPatM.value.set(scale * Math.cos(a), -scale * Math.sin(a), 0, scale * Math.sin(a), scale * Math.cos(a), 0, 0, 0, 1)
  }

  private setPattern(part: Part, canvas: HTMLCanvasElement) {
    const t = new CanvasTexture(canvas)
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    part.uniforms.uPat.value = t
    part.uniforms.uPatOn.value = 1
    this.dirty = true
  }

  private async syncLayers(d: Design) {
    const live = d.layers.slice(0, MAX_LAYERS)
    const ids = new Set(live.map((l) => l.id))
    this.slots = this.slots.map((s) => (s && ids.has(s.id) ? s : null))
    const uploads: Promise<void>[] = []
    for (const l of live) {
      const key = rasterKey(l)
      let index = this.slots.findIndex((s) => s?.id === l.id)
      if (index < 0) {
        index = this.slots.indexOf(null)
        this.slots[index] = { id: l.id, key: '', aspect: 1, loading: false }
      }
      const slot = this.slots[index]!
      if (slot.key !== key) {
        slot.key = key
        uploads.push(
          rasterLayer(l)
            .then(({ data, aspect }) => {
              if (this.disposed || this.slots[index]?.id !== l.id || slot.key !== key) return
              const image = this.decals.image as unknown as { data: Uint8Array }
              image.data.set(data, index * LAYER_SIZE * LAYER_SIZE * 4)
              this.decals.addLayerUpdate(index)
              this.decals.needsUpdate = true
              slot.aspect = aspect
              this.updateProjectors()
            })
            .catch(() => this.events.onError(`Could not read "${l.name}" — try uploading it again`)),
        )
      }
    }
    this.updateProjectors()
    await Promise.all(uploads)
  }

  private updateProjectors() {
    const d = this.design
    if (!d) return
    let n = 0
    shared.uSel.value = -1
    const m = new Matrix4()
    const x = new Vector3()
    const y = new Vector3()
    const z = new Vector3()
    const up = new Vector3()
    for (const l of d.layers.slice(0, MAX_LAYERS)) {
      const slot = this.slots.findIndex((s) => s?.id === l.id)
      if (slot < 0 || !l.visible) continue
      const aspect = this.slots[slot]!.aspect
      z.set(l.n[0], l.n[1], l.n[2]).normalize()
      up.set(0, 1, 0)
      if (Math.abs(z.y) > 0.95) up.set(0, 0, -1)
      x.crossVectors(up, z).normalize()
      y.crossVectors(z, x)
      const cos = Math.cos(l.rotation)
      const sin = Math.sin(l.rotation)
      const xr = x.clone().multiplyScalar(cos).addScaledVector(y, sin)
      const yr = y.clone().multiplyScalar(cos).addScaledVector(x, -sin)
      const w = l.size
      const h = l.size / aspect
      const depth = 0.24
      m.makeBasis(xr.multiplyScalar(w), yr.multiplyScalar(h), z.clone().multiplyScalar(depth))
      m.setPosition(l.p[0], l.p[1], l.p[2])
      shared.uDecalM.value[n].copy(m).invert()
      shared.uDecalDir.value[n].copy(z)
      shared.uDecalP.value[n].set(l.opacity, FINISHES.findIndex((f) => f.id === l.finish), l.size, slot)
      if (l.id === this.selectedLayer) shared.uSel.value = n
      n++
    }
    shared.uDecalN.value = n
    this.dirty = true
  }

  /* ── Picking ─────────────────────────────────────────────────── */
  private ensureBvh() {
    for (const p of this.parts.values()) {
      if (p.mesh.name === 'stitching') continue
      const geometry = p.mesh.geometry as BufferGeometry & { boundsTree?: MeshBVH }
      if (!geometry.boundsTree) geometry.boundsTree = new MeshBVH(geometry)
      p.mesh.raycast = acceleratedRaycast
    }
  }

  private targets() {
    return [...this.parts.values()].map((p) => p.mesh).filter((m) => m.name !== 'stitching')
  }

  private castFrom(origin: Vector3, dir: Vector3) {
    this.ensureBvh()
    this.root.updateMatrixWorld(true)
    this.ray.set(origin, dir)
    const r = this.ray as Raycaster & { firstHitOnly?: boolean }
    r.firstHitOnly = false
    const hits = this.ray.intersectObjects(this.targets(), false)
    return hits.find((h) => this.isVisibleLocal(this.root.worldToLocal(h.point.clone()))) ?? null
  }

  private isVisibleLocal(p: Vector3) {
    const spec = this.active ? GARMENTS[this.active].sleeve : undefined
    if (spec && Math.abs(p.x) > spec.minX && p.y > spec.minY) {
      const n = shared.uSleeveN.value
      return Math.abs(p.x) * n.x + p.y * n.y <= shared.uSleeveD.value
    }
    return p.y >= shared.uCutY.value
  }

  private pointerHit(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    return this.castFrom(this.ray.ray.origin.clone(), this.ray.ray.direction.clone())
  }

  /** Average normal around a point: stops artwork twitching over small wrinkles. */
  private stableNormal(point: Vector3, normal: Vector3) {
    const sum = normal.clone()
    const tangent = new Vector3(0, 1, 0).cross(normal)
    if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0)
    tangent.normalize()
    const bi = normal.clone().cross(tangent)
    const toObject = new Vector3()
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const origin = point.clone().addScaledVector(normal, 0.2).addScaledVector(tangent, a * 0.035).addScaledVector(bi, b * 0.035)
      const hit = this.castFrom(origin, toObject.copy(normal).negate())
      if (hit?.normal) sum.add(hit.normal.clone().transformDirection(hit.object.matrixWorld))
    }
    return sum.normalize()
  }

  private layerAt(local: Vector3, normal: Vector3): Layer | null {
    const d = this.design
    if (!d) return null
    const layers = d.layers.slice(0, MAX_LAYERS).filter((l) => l.visible)
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      const slot = this.slots.findIndex((s) => s?.id === l.id)
      const idx = d.layers.filter((x) => x.visible).indexOf(l)
      if (slot < 0 || idx < 0) continue
      const q = local.clone().applyMatrix4(shared.uDecalM.value[idx])
      if (Math.abs(q.x) <= 0.5 && Math.abs(q.y) <= 0.5 && Math.abs(q.z) <= 0.5 && normal.dot(shared.uDecalDir.value[idx]) > 0.05) return l
    }
    return null
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !this.active) return
    const hit = this.pointerHit(e)
    let layer: Layer | null = null
    if (hit?.normal) {
      const local = this.root.worldToLocal(hit.point.clone())
      layer = this.layerAt(local, hit.normal.clone().transformDirection(hit.object.matrixWorld))
    }
    this.press = { x: e.clientX, y: e.clientY, layer: layer?.id ?? null }
    if (layer && layer.id === this.selectedLayer) {
      this.drag = { id: layer.id, moved: false }
      this.controls.enabled = false
      this.renderer.domElement.setPointerCapture(e.pointerId)
    }
  }

  private onMove = (e: PointerEvent) => {
    if (this.drag) {
      const hit = this.pointerHit(e)
      if (!hit?.normal) return
      const worldN = hit.normal.clone().transformDirection(hit.object.matrixWorld)
      const stable = this.stableNormal(hit.point, worldN)
      const local = this.root.worldToLocal(hit.point.clone())
      const scale = this.root.scale
      const n = new Vector3(stable.x * scale.x, stable.y * scale.y, stable.z * scale.z).normalize()
      this.drag.moved = true
      this.events.onMoveLayer(this.drag.id, [local.x, local.y, local.z], [n.x, n.y, n.z])
      return
    }
    if (e.buttons || e.pointerType !== 'mouse' || !this.active) return
    const hit = this.pointerHit(e)
    const name = hit ? hit.object.name : null
    if (name !== this.hovered) {
      if (this.hovered) this.parts.get(this.hovered)?.mesh.material.emissive.setScalar(0)
      if (name) this.parts.get(name)?.mesh.material.emissive.setRGB(0.035, 0.028, 0.01)
      this.hovered = name
      this.renderer.domElement.style.cursor = name ? 'pointer' : 'grab'
      this.dirty = true
    }
  }

  private onLeave = () => {
    if (this.hovered) this.parts.get(this.hovered)?.mesh.material.emissive.setScalar(0)
    this.hovered = null
    this.dirty = true
  }

  private onUp = (e: PointerEvent) => {
    const press = this.press
    this.press = null
    this.controls.enabled = true
    if (this.drag) {
      const { moved } = this.drag
      this.drag = null
      if (moved) this.events.onMoveEnd()
      return
    }
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) return
    if (press.layer) return this.events.onPick({ type: 'layer', id: press.layer })
    const hit = this.pointerHit(e)
    this.events.onPick(hit ? { type: 'part', id: hit.object.name } : null)
  }

  /** Where a preset placement lands on the current garment. */
  locate(p: Placement): { p: [number, number, number]; n: [number, number, number] } | null {
    if (!this.active) return null
    const fit = this.root.scale
    const origin = new Vector3(p.x * fit.x, p.y, (p.z ?? 0) * fit.z)
    const dir = new Vector3()
    if (p.side === 'front') { origin.z = 1; dir.set(0, 0, -1) }
    if (p.side === 'back') { origin.z = -1; dir.set(0, 0, 1) }
    if (p.side === 'left') { origin.x = 1; origin.z = this.sleeveCentreZ * fit.z; dir.set(-1, 0, 0) }
    if (p.side === 'right') { origin.x = -1; origin.z = this.sleeveCentreZ * fit.z; dir.set(1, 0, 0) }
    const hit = this.castFrom(origin, dir)
    if (!hit?.normal) return null
    const worldN = hit.normal.clone().transformDirection(hit.object.matrixWorld)
    const stable = this.stableNormal(hit.point, worldN)
    const local = this.root.worldToLocal(hit.point.clone())
    const n = new Vector3(stable.x * fit.x, stable.y * fit.y, stable.z * fit.z).normalize()
    // Presets face the viewer squarely: the wrinkle under one point must not tilt a whole wordmark.
    if (p.side === 'front' || p.side === 'back') n.lerp(dir.clone().negate(), 0.85).normalize()
    return { p: [local.x, local.y, local.z], n: [n.x, n.y, n.z] }
  }

  /** Key light rides with the camera (up and to the side), like a photographer's: every side reads the same. */
  private aimKey(camera: PerspectiveCamera) {
    const toCam = camera.position.clone().sub(this.center).setY(0).normalize()
    const side = new Vector3(toCam.z, 0, -toCam.x)
    this.key.position.copy(this.center).addScaledVector(toCam, 1.9).addScaledVector(side, 0.9).add(new Vector3(0, 1.4, 0))
  }

  /* ── Frame loop ──────────────────────────────────────────────── */
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.start) / 620)
      const k = 1 - Math.pow(1 - t, 3)
      const polar = this.tween.polarFrom + (Math.PI / 2 - 0.05 - this.tween.polarFrom) * k
      this.placeCamera(this.tween.from + (this.tween.to - this.tween.from) * k, polar)
      if (t === 1) this.tween = null
    } else {
      this.controls.update()
    }
    if (this.rhythm) this.applyMotion(performance.now())
    if (!this.dirty) return
    this.dirty = false
    this.aimKey(this.camera)
    this.renderer.render(this.scene, this.camera)
    this.emitOverlay()
  }

  private emitOverlay() {
    const d = this.design
    const l = d?.layers.find((x) => x.id === this.selectedLayer && x.visible)
    const slot = l ? this.slots.find((s) => s?.id === l.id) : null
    if (!l || !slot) return this.events.onOverlay(null)
    const idx = d!.layers.filter((x) => x.visible).indexOf(l)
    const inv = new Matrix4().copy(shared.uDecalM.value[idx]).invert()
    const rect = this.renderer.domElement.getBoundingClientRect()
    const toScreen = (qx: number, qy: number): [number, number] => {
      const v = new Vector3(qx, qy, 0).applyMatrix4(inv).applyMatrix4(this.root.matrixWorld).project(this.camera)
      return [(v.x * 0.5 + 0.5) * rect.width, (-v.y * 0.5 + 0.5) * rect.height]
    }
    const worldN = new Vector3(...l.n).transformDirection(this.root.matrixWorld)
    const toCam = this.camera.position.clone().sub(new Vector3(...l.p).applyMatrix4(this.root.matrixWorld)).normalize()
    const c = toScreen(0, 0)
    const top = toScreen(0, 0.5)
    const len = Math.hypot(top[0] - c[0], top[1] - c[1]) || 1
    this.events.onOverlay({
      visible: worldN.dot(toCam) > 0.15,
      center: c,
      scale: toScreen(0.5, -0.5),
      rotate: [top[0] + ((top[0] - c[0]) / len) * 26, top[1] + ((top[1] - c[1]) / len) * 26],
    })
  }

  requestRender() {
    this.dirty = true
  }

  /* ── Output ──────────────────────────────────────────────────── */
  /** Renders a clean product shot (no selection outline, opaque backdrop). */
  async snapshot(view: View, width: number, height: number, background: string, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
    const renderer = this.renderer
    const camera = new PerspectiveCamera(this.camera.fov, width / height, 0.05, 20)
    const a = VIEW_ANGLE[view]
    const save = { sel: shared.uSel.value, pr: renderer.getPixelRatio(), size: renderer.getSize(new Vector2()), hovered: this.hovered }
    if (this.hovered) this.parts.get(this.hovered)?.mesh.material.emissive.setScalar(0)
    const dist = this.fitDistance(camera, 0.16, 0.1)
    camera.position.set(Math.sin(a) * dist, this.center.y + 0.04, Math.cos(a) * dist)
    camera.lookAt(this.center)
    shared.uSel.value = -1
    const sweep = backdropTexture(background, width, height)
    this.scene.background = sweep
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    this.aimKey(camera)
    renderer.render(this.scene, camera)
    const capture = new Promise<Blob | null>((res) => renderer.domElement.toBlob(res, type, quality))
    this.scene.background = null
    sweep.dispose()
    shared.uSel.value = save.sel
    renderer.setPixelRatio(save.pr)
    renderer.setSize(save.size.x, save.size.y, false)
    if (save.hovered) this.parts.get(save.hovered)?.mesh.material.emissive.setRGB(0.035, 0.028, 0.01)
    this.dirty = true
    const blob = await capture
    if (!blob) throw new Error('Could not capture the render')
    return blob
  }
}

function backdropTexture(hex: string, width: number, height: number) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = Math.max(2, Math.round((512 * height) / width))
  const c = cv.getContext('2d')!
  const [inner, outer] = backdropStops(hex)
  const g = c.createRadialGradient(256, cv.height * 0.42, 0, 256, cv.height * 0.42, Math.max(cv.width, cv.height) * 0.75)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  c.fillStyle = g
  c.fillRect(0, 0, cv.width, cv.height)
  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  return t
}

function blobTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const c = cv.getContext('2d')!
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(25,18,8,1)')
  g.addColorStop(0.45, 'rgba(25,18,8,.55)')
  g.addColorStop(1, 'rgba(25,18,8,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 256, 256)
  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A small virtual photo studio: walls plus emissive softboxes, baked into a PMREM. */
function buildEnv(kind: Light) {
  const scene = new Scene()
  const wall = kind === 'noir' ? 0.015 : kind === 'daylight' ? 0.48 : 0.26
  const room = new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ color: new Color(wall, wall * 0.99, wall * 0.97), side: 1 }))
  scene.add(room)
  const panel = (x: number, y: number, z: number, w: number, h: number, power: number, tint = 0xffffff) => {
    const material = new MeshBasicMaterial({ color: new Color(tint).multiplyScalar(power) })
    const mesh = new Mesh(new PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  if (kind === 'studio') {
    panel(-3.4, 1.4, 3, 2.6, 4, 7, 0xfffaf4)
    panel(3.8, 0.8, 2, 1.6, 4, 3.6)
    panel(0, 4.6, 0.5, 4, 3, 8)
    panel(0.5, 1, -4.4, 5, 2, 3.2)
    panel(0, -4.6, 0, 6, 6, 0.5, 0xf6f1e8)
  } else if (kind === 'daylight') {
    panel(-2.5, 3.2, 3, 5, 4, 7.5, 0xfff1da)
    panel(4.4, 0.6, 1, 2, 5, 3, 0xdfeaff)
    panel(0, -4.6, 0, 8, 8, 1.2, 0xf4e8d4)
  } else {
    panel(-4, 1.2, 1.6, 0.9, 5, 20, 0xffe9cc)
    panel(4, 1.8, -1.4, 0.7, 5, 14, 0xdfe7ff)
    panel(0, 4.6, 0, 2, 2, 3)
  }
  return scene
}

