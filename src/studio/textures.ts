/* Everything raster: procedural fabric maps, tiling patterns and artwork layers. No image downloads needed. */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, type Texture, UnsignedByteType } from 'three'
import { type Layer, SHAPES, fabricById, type PatternStyle } from './catalog'

const N = 512
const TAU = Math.PI * 2

/* ── Tileable noise ─────────────────────────────────────────────── */
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function periodicNoise(u: number, v: number, period: number) {
  const x = u * period
  const y = v * period
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const at = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period)
  const top = at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx
  const bottom = at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx
  return top * (1 - sy) + bottom * sy
}
const fbm = (u: number, v: number, base: number) => periodicNoise(u, v, base) * 0.55 + periodicNoise(u, v, base * 2) * 0.3 + periodicNoise(u, v, base * 4) * 0.15

/* ── Weave height fields: height(u, v) in 0..1 over one tile ─────
   Frequencies are powers of two so mip levels average to flat instead of beating into moiré. */
const weave = (u: number, v: number, n: number) => {
  const cu = Math.floor(u * n)
  const cv = Math.floor(v * n)
  const over = (cu + cv) % 2 === 0
  const fu = Math.sin(((u * n) % 1) * Math.PI)
  const fv = Math.sin(((v * n) % 1) * Math.PI)
  return over ? fu * 0.35 + fv * 0.65 : fv * 0.35 + fu * 0.65
}

const HEIGHT: Record<string, (u: number, v: number) => number> = {
  jersey: (u, v) => knit(u, v, 32),
  heavy: (u, v) => knit(u, v, 32) * 0.9 + periodicNoise(u, v, 128) * 0.1,
  fleece: (u, v) => fbm(u, v, 64) * 0.7 + periodicNoise(u, v, 200) * 0.3,
  pique: (u, v) => {
    const n = 16
    const row = Math.floor(v * n)
    const x = u * n + (row % 2) * 0.5
    const cell = Math.abs(Math.sin(x * Math.PI)) * Math.abs(Math.sin(v * n * Math.PI))
    return Math.pow(cell, 0.6)
  },
  rib: (u) => Math.pow(Math.abs(Math.sin(u * 16 * Math.PI)), 0.7),
  waffle: (u, v) => 1 - Math.min(1, Math.pow(Math.abs(Math.sin(u * 8 * Math.PI)) * Math.abs(Math.sin(v * 8 * Math.PI)), 0.5) * 1.1),
  twill: (u, v) => (Math.sin(TAU * (u + v) * 32) * 0.5 + 0.5) * (0.82 + 0.18 * Math.sin(TAU * v * 128)),
  denim: (u, v) => (Math.sin(TAU * (u * 32 + v * 32)) * 0.5 + 0.5) * 0.78 + periodicNoise(u, v, 256) * 0.22,
  canvas: (u, v) => weave(u, v, 32),
  linen: (u, v) => weave(u, v, 32) * 0.62 + periodicNoise(u, v * 0.125, 64) * 0.2 + periodicNoise(u * 0.125, v, 64) * 0.18,
  corduroy: (u, v) => Math.pow(Math.abs(Math.sin(u * 8 * Math.PI)), 0.45) * (0.93 + 0.07 * fbm(u, v, 90)),
  satin: (_u, v) => 0.5 + 0.5 * Math.sin(TAU * v * 64) * 0.5,
  leather: (u, v) => {
    const a = fbm(u, v, 22)
    return Math.min(1, Math.abs(a - 0.5) * 7) * 0.8 + fbm(u, v, 80) * 0.2
  },
}

function knit(u: number, v: number, rows: number) {
  const r = v * rows
  const row = Math.floor(r)
  const fv = r - row
  const x = u * rows + (row % 2) * 0.5
  const fu = x - Math.floor(x)
  const loop = Math.abs(fu - 0.5 + (fv - 0.5) * 0.45) * 2
  return (1 - loop * loop) * Math.sin(fv * Math.PI)
}

export interface FabricMaps { normal: Texture; roughness: Texture; albedo: Texture }
const fabricCache = new Map<string, FabricMaps>()

function dataTexture(data: Uint8Array, repeat: number): DataTexture {
  const t = new DataTexture(data, N, N, RGBAFormat, UnsignedByteType)
  t.wrapS = t.wrapT = RepeatWrapping
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.repeat.set(repeat, repeat)
  t.needsUpdate = true
  return t
}

/** One UV unit is ~1.1 m on both garments (CLO atlases are drawn to scale). */
export const UV_METRES = 1.1

export function fabricMaps(id: string): FabricMaps {
  const hit = fabricCache.get(id)
  if (hit) return hit
  const def = fabricById(id)
  const f = HEIGHT[id] ?? HEIGHT.jersey
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = f(x / N, y / N)

  const normal = new Uint8Array(N * N * 4)
  const rough = new Uint8Array(N * N * 4)
  const albedo = new Uint8Array(N * N * 4)
  const strength = 3.2
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4
      const c = h[y * N + x]
      const dx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)]) * strength
      const dy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * strength
      const l = Math.hypot(dx, dy, 1)
      normal[i] = ((-dx / l) * 0.5 + 0.5) * 255
      normal[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255
      normal[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      normal[i + 3] = 255
      const r = 0.86 + 0.14 * (1 - c)
      rough[i] = rough[i + 1] = rough[i + 2] = r * 255
      rough[i + 3] = 255
      // r: cavity multiplier. g: white fleck amount (denim weft showing through).
      albedo[i] = (0.84 + 0.16 * c) * 255
      albedo[i + 1] = id === 'denim' ? Math.max(0, c - 0.55) * 0.42 * 255 : id === 'linen' ? Math.max(0, c - 0.75) * 0.25 * 255 : 0
      albedo[i + 3] = 255
    }
  }
  const repeat = UV_METRES / def.tile
  const maps = { normal: dataTexture(normal, repeat), roughness: dataTexture(rough, repeat), albedo: dataTexture(albedo, repeat) }
  fabricCache.set(id, maps)
  return maps
}

/* ── Tiling all-over patterns ───────────────────────────────────── */
export function drawPattern(p: PatternStyle, base: string, image: HTMLImageElement | null): HTMLCanvasElement {
  const S = 1024
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const c = cv.getContext('2d')!
  c.fillStyle = base
  c.fillRect(0, 0, S, S)
  c.fillStyle = p.color
  switch (p.kind) {
    case 'stripes':
      c.fillRect(0, 0, S, S / 2)
      break
    case 'pinstripe':
      c.fillRect(0, 0, S, S / 18)
      break
    case 'check':
      c.globalAlpha = 0.72
      c.fillRect(0, 0, S / 2, S)
      c.fillRect(0, 0, S, S / 2)
      break
    case 'gingham':
      c.globalAlpha = 0.5
      for (let i = 0; i < 4; i += 2) {
        c.fillRect((i * S) / 4, 0, S / 4, S)
        c.fillRect(0, (i * S) / 4, S, S / 4)
      }
      break
    case 'dots':
      for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) {
        c.beginPath()
        c.arc(x * S, y * S, S * 0.1, 0, TAU)
        c.fill()
      }
      break
    case 'camo':
    case 'tiedye': {
      const img = c.getImageData(0, 0, S, S)
      const a = hexRgb(base)
      const b = hexRgb(p.color)
      const shade = [a[0] * 0.62, a[1] * 0.62, a[2] * 0.62]
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = x / S
          const v = y / S
          const i = (y * S + x) * 4
          let col: number[]
          if (p.kind === 'camo') {
            const n = fbm(u, v, 5)
            col = n > 0.56 ? b : n < 0.42 ? shade : a
          } else {
            // Ripples around a tileable warp, like a folded tie-dye.
            const warp = fbm(u, v, 3) * 2.4 + Math.sin(TAU * u) * 0.35 + Math.cos(TAU * v) * 0.35
            const t = Math.sin(warp * 16) * 0.5 + 0.5
            col = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t)
          }
          img.data[i] = col[0]
          img.data[i + 1] = col[1]
          img.data[i + 2] = col[2]
        }
      }
      c.putImageData(img, 0, 0)
      break
    }
    case 'image':
      if (image) c.drawImage(image, 0, 0, S, S)
      break
    case 'solid':
      break
  }
  c.globalAlpha = 1
  return cv
}

export function hexRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/* ── Artwork layers ─────────────────────────────────────────────── */
const images = new Map<string, Promise<HTMLImageElement>>()
export function loadImage(src: string): Promise<HTMLImageElement> {
  let hit = images.get(src)
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Image failed to load'))
      i.src = src
    })
    images.set(src, hit)
  }
  return hit
}

export const LAYER_SIZE = 1024

/** Changing this key is what triggers a re-raster, so position-only edits stay instant. */
export const rasterKey = (l: Layer) =>
  [l.kind, l.color, l.text, l.font, l.weight, l.tracking, l.curve, l.outline, l.outlineColor, l.src?.length, l.src?.slice(-32), l.knockout, l.shape].join('|')

function drawText(ctx: CanvasRenderingContext2D, l: Layer): { draw: (c: CanvasRenderingContext2D) => void; w: number; h: number } {
  const px = 220
  const lines = (l.text || ' ').split('\n')
  const font = `${l.weight ?? 700} ${px}px "${l.font ?? 'Space Grotesk'}", sans-serif`
  const tracking = (l.tracking ?? 0) * px
  ctx.font = font
  const lineH = px * 1.12
  const stroke = (l.outline ?? 0) * px
  const pad = px * 0.14 + stroke
  const glyphs = (t: string) => [...t].map((ch) => ({ ch, w: ctx.measureText(ch).width + tracking }))
  const measured = lines.map(glyphs)
  const widths = measured.map((g) => g.reduce((s, x) => s + x.w, 0) - tracking)
  const textW = Math.max(1, ...widths)
  const curve = l.curve ?? 0

  if (Math.abs(curve) < 0.01) {
    const w = textW + pad * 2
    const h = lineH * lines.length + pad * 2
    return {
      w,
      h,
      draw: (c) => {
        c.font = font
        c.textBaseline = 'middle'
        c.lineJoin = 'round'
        measured.forEach((row, li) => {
          let x = pad + (textW - widths[li]) / 2
          const y = pad + lineH * (li + 0.5)
          for (const g of row) {
            if (stroke) {
              c.lineWidth = stroke * 2
              c.strokeStyle = l.outlineColor ?? '#000'
              c.strokeText(g.ch, x, y)
            }
            c.fillStyle = l.color
            c.fillText(g.ch, x, y)
            x += g.w
          }
        })
      },
    }
  }

  // Arched text: first line only keeps the layout honest and legible.
  const row = measured[0]
  const arc = Math.max(0.05, Math.abs(curve)) * Math.PI
  const radius = widths[0] / arc
  const up = curve > 0
  const span = radius * (1 - Math.cos(Math.min(arc, Math.PI) / 2))
  const w = (arc >= Math.PI ? radius * 2 : radius * Math.sin(arc / 2) * 2) + px + pad * 2
  const h = span + px + pad * 2
  return {
    w,
    h,
    draw: (c) => {
      c.font = font
      c.textBaseline = 'middle'
      c.lineJoin = 'round'
      c.textAlign = 'center'
      const cx = w / 2
      const cy = up ? pad + px / 2 + radius : h - pad - px / 2 - radius
      let run = -widths[0] / 2
      for (const g of row) {
        const mid = (run + (g.w - tracking) / 2) / radius
        c.save()
        c.translate(cx + Math.sin(mid) * radius, cy + (up ? -1 : 1) * Math.cos(mid) * radius)
        c.rotate(up ? mid : -mid)
        if (stroke) {
          c.lineWidth = stroke * 2
          c.strokeStyle = l.outlineColor ?? '#000'
          c.strokeText(g.ch, 0, 0)
        }
        c.fillStyle = l.color
        c.fillText(g.ch, 0, 0)
        c.restore()
        run += g.w
      }
    },
  }
}

/** Rasters a layer into a square canvas (stretched; the projector's aspect undoes it). */
export async function rasterLayer(l: Layer): Promise<{ data: Uint8Array; aspect: number }> {
  const cv = document.createElement('canvas')
  cv.width = cv.height = LAYER_SIZE
  const c = cv.getContext('2d', { willReadFrequently: true })!
  let aspect = 1

  if (l.kind === 'text') {
    if (l.font) await document.fonts.load(`${l.weight ?? 700} 40px "${l.font}"`).catch(() => undefined)
    const t = drawText(c, l)
    aspect = t.w / t.h
    c.setTransform(LAYER_SIZE / t.w, 0, 0, LAYER_SIZE / t.h, 0, 0)
    t.draw(c)
    c.setTransform(1, 0, 0, 1, 0, 0)
  } else if (l.kind === 'shape') {
    const shape = SHAPES.find((s) => s.id === l.shape) ?? SHAPES[0]
    c.scale(LAYER_SIZE / 100, LAYER_SIZE / 100)
    c.fillStyle = l.color
    c.fill(new Path2D(shape.path), 'evenodd')
    c.setTransform(1, 0, 0, 1, 0, 0)
  } else if (l.src) {
    const img = await loadImage(l.src)
    aspect = img.width / img.height
    c.drawImage(img, 0, 0, LAYER_SIZE, LAYER_SIZE)
    if (l.knockout) {
      // Drop near-white backgrounds, with a soft ramp so edges stay clean.
      const d = c.getImageData(0, 0, LAYER_SIZE, LAYER_SIZE)
      for (let i = 0; i < d.data.length; i += 4) {
        const low = Math.min(d.data[i], d.data[i + 1], d.data[i + 2])
        d.data[i + 3] = (d.data[i + 3] * Math.min(1, Math.max(0, (246 - low) / 26))) | 0
      }
      c.putImageData(d, 0, 0)
    }
  }

  // Premultiplied + flipped so v=0 is the bottom row: mips then filter without dark halos.
  const src = c.getImageData(0, 0, LAYER_SIZE, LAYER_SIZE).data
  const out = new Uint8Array(LAYER_SIZE * LAYER_SIZE * 4)
  for (let y = 0; y < LAYER_SIZE; y++) {
    const from = y * LAYER_SIZE * 4
    const to = (LAYER_SIZE - 1 - y) * LAYER_SIZE * 4
    for (let x = 0; x < LAYER_SIZE * 4; x += 4) {
      const a = src[from + x + 3]
      out[to + x] = (src[from + x] * a) / 255
      out[to + x + 1] = (src[from + x + 1] * a) / 255
      out[to + x + 2] = (src[from + x + 2] * a) / 255
      out[to + x + 3] = a
    }
  }
  return { data: out, aspect }
}
