/* A product's 3D design travels with its cover image: `cover.jpg#bm3d=<ref>`. Browsers ignore the fragment when loading
   the picture, and the backend stores it as part of the URL, so no API change is needed. <ref> is either a static .json
   (seeded catalogue) or an uploaded PNG whose pixels hold the JSON (the upload API accepts images only). No three.js here. */
import { api } from '../api/api'
import { media } from '../lib/url'
import type { Design } from './catalog'

const MARK = '#bm3d='
const SOUND = '~' // base64 and paths never contain it

export const designRef = (images: string[]): string | null => {
  const cover = images[0]
  const at = cover?.indexOf(MARK) ?? -1
  return at < 0 ? null : cover.slice(at + MARK.length).split(SOUND)[0]
}

/** The track a brand chose, readable without fetching the design: the feed filters by it. */
export const designSound = (images: string[]): string | null => {
  const cover = images[0]
  const at = cover?.indexOf(MARK) ?? -1
  return at < 0 ? null : (cover.slice(at + MARK.length).split(SOUND)[1] ?? null)
}

export const withDesign = (images: string[], ref?: string | null, sound?: string | null): string[] => {
  if (!ref || !images.length) return images
  return [`${images[0].split(MARK)[0]}${MARK}${ref}${sound ? SOUND + sound : ''}`, ...images.slice(1)]
}

function dataUrlToFile(url: string, name: string): File {
  const [head, body] = url.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'image/png'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type })
}

/** Embedded artwork becomes real uploads, so the stored design stays small. */
async function hostImages(design: Design): Promise<Design> {
  const host = async (src: string | undefined) => (src?.startsWith('data:') ? api.upload(dataUrlToFile(src, 'artwork.png')) : src)
  const layers = await Promise.all(design.layers.map(async (l) => ({ ...l, src: await host(l.src) })))
  const parts: Design['parts'] = {}
  for (const [id, part] of Object.entries(design.parts)) parts[id] = { ...part, pattern: { ...part.pattern, image: await host(part.pattern.image) } }
  return { ...design, layers, parts }
}

async function encode(design: Design): Promise<File> {
  const json = new TextEncoder().encode(JSON.stringify(design))
  const payload = new Uint8Array(json.length + 4)
  new DataView(payload.buffer).setUint32(0, json.length)
  payload.set(json, 4)
  const side = Math.ceil(Math.sqrt(payload.length / 3))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = side
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(side, side)
  for (let i = 0, p = 0; p < side * side; p++, i += 3) {
    image.data[p * 4] = payload[i] ?? 0
    image.data[p * 4 + 1] = payload[i + 1] ?? 0
    image.data[p * 4 + 2] = payload[i + 2] ?? 0
    image.data[p * 4 + 3] = 255 // opaque, so premultiplication can't alter the bytes
  }
  ctx.putImageData(image, 0, 0)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not encode the design')
  return new File([blob], 'design.bm3d.png', { type: 'image/png' })
}

export async function uploadDesign(design: Design): Promise<string> {
  return api.upload(await encode(await hostImages(design)))
}

export async function loadDesign(ref: string): Promise<Design> {
  const res = await fetch(media(ref)!)
  if (!res.ok) throw new Error('Design not found')
  if (ref.endsWith('.json')) return (await res.json()) as Design
  const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const bytes = new Uint8Array((data.length / 4) * 3)
  for (let p = 0, i = 0; p < data.length; p += 4, i += 3) {
    bytes[i] = data[p]
    bytes[i + 1] = data[p + 1]
    bytes[i + 2] = data[p + 2]
  }
  const length = new DataView(bytes.buffer).getUint32(0)
  return JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length))) as Design
}
