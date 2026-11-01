import { create } from 'zustand'
import { defaultDesign, type Design, GARMENTS, type GarmentId, type Layer, type PartStyle } from './catalog'

export type Selection = { type: 'all' } | { type: 'part'; id: string } | { type: 'layer'; id: string }
type Designs = Record<GarmentId, Design>

const KEY = 'bm.studio.v1'
const HISTORY = 60
const COALESCE_MS = 700

const IDS = Object.keys(GARMENTS) as GarmentId[]

function allDesigns() {
  return Object.fromEntries(IDS.map((id) => [id, defaultDesign(id)])) as Designs
}

function restore(): { garment: GarmentId; designs: Designs } {
  const fresh = { garment: 'tee' as GarmentId, designs: allDesigns() }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw)
    saved.designs ??= {}
    for (const id of IDS) {
      const known = GARMENTS[id].parts.every((p) => saved.designs?.[id]?.parts?.[p.id])
      if (!known) saved.designs[id] = defaultDesign(id)
    }
    return { garment: saved.garment in GARMENTS ? saved.garment : 'tee', designs: saved.designs }
  } catch {
    return fresh
  }
}

let saveTimer = 0
function persist(garment: GarmentId, designs: Designs) {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ garment, designs }))
    } catch {
      // Over quota (large uploads): keep the session going, drop embedded images from the saved copy.
      try {
        const strip = (d: Design): Design => ({ ...d, layers: d.layers.filter((l) => l.kind !== 'image') })
        localStorage.setItem(KEY, JSON.stringify({ garment, designs: Object.fromEntries(IDS.map((id) => [id, strip(designs[id])])) }))
      } catch { /* storage unavailable */ }
    }
  }, 400)
}

interface Entry { designs: Designs; garment: GarmentId }

interface StudioState {
  garment: GarmentId
  designs: Designs
  selection: Selection
  past: Entry[]
  future: Entry[]
  lastKey: string
  lastAt: number
  design: () => Design
  select: (s: Selection) => void
  setGarment: (g: GarmentId) => void
  /** Same `key` within a short window merges into one undo step (slider drags, typing). */
  edit: (fn: (d: Design) => Design, key?: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

const initial = restore()

export const useStudio = create<StudioState>((set, get) => ({
  ...initial,
  selection: { type: 'all' },
  past: [],
  future: [],
  lastKey: '',
  lastAt: 0,
  design: () => get().designs[get().garment],
  select: (selection) => set({ selection }),
  setGarment: (garment) => {
    set({ garment, selection: { type: 'all' }, lastKey: '' })
    persist(garment, get().designs)
  },
  edit: (fn, key = '') => {
    const s = get()
    const now = performance.now()
    const merge = key && key === s.lastKey && now - s.lastAt < COALESCE_MS
    const designs = { ...s.designs, [s.garment]: fn(s.designs[s.garment]) }
    set({
      designs,
      past: merge ? s.past : [...s.past, { designs: s.designs, garment: s.garment }].slice(-HISTORY),
      future: [],
      lastKey: key,
      lastAt: now,
    })
    persist(s.garment, designs)
  },
  undo: () => {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev) return
    set({ ...prev, past: s.past.slice(0, -1), future: [{ designs: s.designs, garment: s.garment }, ...s.future], lastKey: '', selection: keepSelection(s.selection, prev) })
    persist(prev.garment, prev.designs)
  },
  redo: () => {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({ ...next, future: s.future.slice(1), past: [...s.past, { designs: s.designs, garment: s.garment }], lastKey: '', selection: keepSelection(s.selection, next) })
    persist(next.garment, next.designs)
  },
  reset: () => {
    const { garment, edit } = get()
    edit(() => defaultDesign(garment))
    set({ selection: { type: 'all' } })
  },
}))

/** Undo must not leave the inspector pointing at a layer that no longer exists. */
function keepSelection(sel: Selection, e: Entry): Selection {
  if (sel.type === 'layer' && !e.designs[e.garment].layers.some((l) => l.id === sel.id)) return { type: 'all' }
  return sel
}

export const patchLayer = (d: Design, id: string, patch: Partial<Layer>): Design => ({
  ...d,
  layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
})

export const patchParts = (d: Design, ids: string[], patch: (p: PartStyle) => Partial<PartStyle>): Design => {
  const parts = { ...d.parts }
  for (const id of ids) parts[id] = { ...parts[id], ...patch(parts[id]) }
  return { ...d, parts }
}
