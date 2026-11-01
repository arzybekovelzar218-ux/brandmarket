import { Music2, Pause, Play, Check, ChevronDown, ChevronLeft, ChevronUp, Copy, Download, Eye, EyeOff, ImagePlus, Layers, Loader2, Lightbulb, Palette, Redo2, RotateCcw, RotateCw, Ruler, Shapes, Shirt, Trash2, Type, Undo2, Upload as UploadIcon, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/cn'
import { useAuth } from '../store/auth'
import { usePendingDesign } from '../store/pendingDesign'
import { toast } from '../store/toast'
import { BACKDROPS, backdropCss, DEFAULT_BACKDROP, FABRICS, FINISHES, FONT_CSS, FONTS, GARMENTS, type GarmentId, HARDWARE, type Layer, PATTERNS, type PatternKind, productType, SHAPES, specLines, SWATCHES } from '../studio/catalog'
import { type Light, type Overlay, StudioEngine, type View } from '../studio/engine'
import { player } from '../feed/sound'
import { TRACKS } from '../feed/tracks'
import { uploadDesign } from '../studio/productDesign'
import { patchLayer, patchParts, useStudio } from '../studio/store'

type Tab = 'model' | 'color' | 'art' | 'fit' | 'scene' | 'show'
const TABS: { id: Tab; label: string; icon: typeof Shirt }[] = [
  { id: 'model', label: 'Model', icon: Shirt },
  { id: 'color', label: 'Fabric', icon: Palette },
  { id: 'art', label: 'Artwork', icon: Layers },
  { id: 'fit', label: 'Fit', icon: Ruler },
  { id: 'scene', label: 'Light', icon: Lightbulb },
  { id: 'show', label: 'Show', icon: Music2 },
]
const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'three', label: '3/4' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
]

const uid = () => Math.random().toString(36).slice(2, 10)
const MAX_LAYERS = 8

export default function StudioPage() {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<StudioEngine | null>(null)
  const [tab, setTab] = useState<Tab>('color')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [webgl, setWebgl] = useState(true)
  const [spin, setSpin] = useState(false)
  const [light, setLight] = useState<Light>('studio')
  const [view, setView] = useState<View | null>('three')
  const scaleHandle = useRef<HTMLButtonElement>(null)
  const rotateHandle = useRef<HTMLButtonElement>(null)
  const overlay = useRef<Overlay | null>(null)
  const navigate = useNavigate()
  const setPending = usePendingDesign((s) => s.set)

  const garment = useStudio((s) => s.garment)
  const design = useStudio((s) => s.designs[s.garment])
  const selection = useStudio((s) => s.selection)
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const { edit, select, undo, redo, setGarment, reset } = useStudio.getState()
  const selectedLayer = selection.type === 'layer' ? selection.id : null
  const backdrop = design.backdrop ?? DEFAULT_BACKDROP

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_CSS
    document.head.appendChild(link)
    return () => link.remove()
  }, [])

  useEffect(() => {
    if (!host.current) return
    let instance: StudioEngine
    try {
      instance = new StudioEngine(host.current, {
        onPick: (t) => {
          if (!t) return useStudio.getState().select({ type: 'all' })
          useStudio.getState().select(t)
          setTab(t.type === 'layer' ? 'art' : 'color')
        },
        onMoveLayer: (id, p, n) => useStudio.getState().edit((d) => patchLayer(d, id, { p, n }), `move:${id}`),
        onMoveEnd: () => useStudio.setState({ lastKey: '' }),
        onOverlay: (o) => {
          overlay.current = o
          for (const [el, at] of [[scaleHandle.current, o?.scale], [rotateHandle.current, o?.rotate]] as const) {
            if (!el) continue
            el.style.display = o?.visible && at ? 'grid' : 'none'
            if (at) el.style.transform = `translate(${at[0]}px, ${at[1]}px) translate(-50%, -50%)`
          }
        },
        onLoading: setLoading,
        onOrbit: () => setView(null),
        onError: (message) => toast(message, { tone: 'error' }),
      })
    } catch {
      setWebgl(false)
      setLoading(false)
      return
    }
    engine.current = instance
    return () => {
      instance.dispose()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    engine.current?.apply(design, selectedLayer)
  }, [design, selectedLayer])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && useStudio.getState().selection.type === 'layer') {
        const sel = useStudio.getState().selection as { id: string }
        edit((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== sel.id) }))
        select({ type: 'all' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [edit, select, undo, redo])

  const changeView = (v: View) => {
    setView(v)
    engine.current?.setView(v)
  }

  /** Adds a layer at the garment's first placement that isn't taken yet. */
  const addLayer = useCallback((base: Partial<Layer> & Pick<Layer, 'kind' | 'name'>) => {
    const d = useStudio.getState().design()
    if (d.layers.length >= MAX_LAYERS) return toast(`Up to ${MAX_LAYERS} artwork layers per garment`, { tone: 'error' })
    const placements = GARMENTS[d.garment].placements
    const taken = (x: number, y: number) => d.layers.some((l) => Math.hypot(l.p[0] - x, l.p[1] - y) < 0.06)
    const place = placements.find((p) => p.side === 'front' && !taken(p.x, p.y)) ?? placements[0]
    const at = engine.current?.locate(place)
    if (!at) return toast('The model is still loading', { tone: 'error' })
    const layer: Layer = { id: uid(), visible: true, ...at, size: place.size, rotation: 0, opacity: 1, finish: 'print', color: '#16130e', ...base }
    edit((cur) => ({ ...cur, layers: [...cur.layers, layer] }))
    select({ type: 'layer', id: layer.id })
    setTab('art')
    if (place.side === 'front') changeView('front')
  }, [edit, select])

  const startHandle = (mode: 'scale' | 'rotate') => (e: React.PointerEvent<HTMLButtonElement>) => {
    const o = overlay.current
    const sel = useStudio.getState().selection
    const layer = sel.type === 'layer' ? useStudio.getState().design().layers.find((l) => l.id === sel.id) : null
    if (!o || !layer) return
    e.preventDefault()
    e.stopPropagation()
    const rect = host.current!.getBoundingClientRect()
    const cx = o.center[0] + rect.left
    const cy = o.center[1] + rect.top
    const d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx)
    const onMove = (ev: PointerEvent) => {
      if (mode === 'scale') {
        const size = Math.min(0.6, Math.max(0.015, (layer.size * Math.hypot(ev.clientX - cx, ev.clientY - cy)) / d0))
        edit((d) => patchLayer(d, layer.id, { size }), `handle:${layer.id}`)
      } else {
        const rotation = layer.rotation - (Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0)
        edit((d) => patchLayer(d, layer.id, { rotation }), `handle:${layer.id}`)
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      useStudio.setState({ lastKey: '' })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const renderShots = async () => {
    const e = engine.current!
    const shots: Blob[] = []
    for (const v of ['front', 'back', 'three'] as View[]) shots.push(await e.snapshot(v, 1200, 1600, backdrop))
    return shots
  }

  const useInDrop = async () => {
    setBusy('drop')
    try {
      const shots = await renderShots()
      const images: string[] = []
      for (const [i, blob] of shots.entries()) images.push(await api.upload(new File([blob], `studio-${garment}-${i + 1}.jpg`, { type: 'image/jpeg' })))
      const main = design.parts.front
      const designRef = await uploadDesign(design)
      setPending({
        designRef,
        sound: design.sound,
        name: '',
        type: productType(design),
        images,
        colors: [main.color],
        description: specLines(design).join('\n').slice(0, 2000),
      })
      toast('Design added to your drop')
      navigate('/create')
    } catch (err) {
      toast(errorMessage(err, 'Could not save the design'), { tone: 'error' })
      setBusy(null)
    }
  }

  const exportSheet = async () => {
    setBusy('sheet')
    try {
      const [front, back] = await renderShots()
      const blob = await techSheet(front, back, productType(design), specLines(design))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `brandmarket-techpack-${garment}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(errorMessage(err, 'Could not build the tech pack'), { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <Link to="/create" aria-label="Back to Create" className="grid size-9 place-items-center rounded-full text-fg-2 hover:bg-surface-2"><ChevronLeft className="size-5" /></Link>
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold leading-tight">3D Studio</p>
          <p className="hidden truncate text-[11px] text-muted sm:block">{GARMENTS[garment].label} · autosaved</p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <IconButton label="Undo" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" /></IconButton>
          <IconButton label="Redo" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" /></IconButton>
          <span className="hidden sm:block"><IconButton label="Start over" onClick={reset}><RotateCcw className="size-4" /></IconButton></span>
          <span className="hidden sm:block"><Button variant="outline" size="sm" onClick={exportSheet} loading={busy === 'sheet'} disabled={!!busy || loading}><Download className="size-4" /> Tech pack</Button></span>
          <Button variant="ink" size="sm" onClick={useInDrop} loading={busy === 'drop'} disabled={!!busy || loading}><Send className="size-4" /> Use in drop</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        {/* Tool rail + panel */}
        <div className="flex min-h-0 flex-1 flex-col border-line lg:w-[388px] lg:flex-none lg:flex-row lg:border-r">
          <nav className="order-last flex shrink-0 justify-around border-t border-line bg-surface lg:order-first lg:w-[68px] lg:flex-col lg:justify-start lg:gap-1 lg:border-r lg:border-t-0 lg:py-3">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id} className={cn('flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors lg:flex-none', tab === t.id ? 'text-fg' : 'text-muted hover:text-fg')}>
                <span className={cn('grid size-8 place-items-center rounded-full', tab === t.id && 'bg-ink text-ink-fg')}><t.icon className="size-4" /></span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface p-5">
            {tab === 'model' && <ModelPanel garment={garment} onPick={setGarment} />}
            {tab === 'color' && <ColorPanel />}
            {tab === 'art' && <ArtPanel engine={engine} addLayer={addLayer} onView={changeView} />}
            {tab === 'fit' && <FitPanel />}
            {tab === 'show' && <ShowPanel />}
            {tab === 'scene' && <ScenePanel light={light} backdrop={backdrop} spin={spin}
              onLight={(l) => { setLight(l); engine.current?.setLight(l) }}
              onBackdrop={(color) => edit((d) => ({ ...d, backdrop: color }), 'backdrop')}
              onSpin={(v) => { setSpin(v); engine.current?.setAutoRotate(v) }} />}
          </div>
        </div>

        {/* Viewport */}
        <div className="relative h-[46dvh] shrink-0 overflow-hidden lg:h-auto lg:flex-1" style={{ background: backdropCss(backdrop) }}>
          <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
          <button ref={scaleHandle} aria-label="Resize artwork" onPointerDown={startHandle('scale')} style={{ display: 'none' }} className="absolute left-0 top-0 size-6 cursor-nwse-resize touch-none place-items-center rounded-full bg-white shadow-lift ring-2 ring-gold"><span className="size-1.5 rounded-full bg-gold" /></button>
          <button ref={rotateHandle} aria-label="Rotate artwork" onPointerDown={startHandle('rotate')} style={{ display: 'none' }} className="absolute left-0 top-0 size-7 cursor-grab touch-none place-items-center rounded-full bg-white text-black shadow-lift ring-2 ring-gold"><RotateCw className="size-3.5" /></button>

          {loading && webgl && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[13px] font-medium text-white"><Loader2 className="size-4 animate-spin" /> Loading model</span></div>}
          {!webgl && <div className="absolute inset-0 grid place-items-center p-8 text-center text-[14px] text-fg-2">3D Studio needs WebGL 2. Please open it in a recent desktop browser.</div>}
          {busy && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10"><span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-[13px] font-medium text-white"><Loader2 className="size-4 animate-spin" /> Rendering</span></div>}

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white/85 p-1 shadow-soft backdrop-blur">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => changeView(v.id)} className={cn('h-8 rounded-full px-3 text-[12px] font-semibold text-black transition-colors', view === v.id ? 'bg-black text-white' : 'hover:bg-black/8')}>{v.label}</button>
            ))}
          </div>
          <p className="pointer-events-none absolute left-4 top-3 hidden text-[12px] text-black/50 mix-blend-difference invert lg:block">Click a part to edit it · drag to orbit · scroll to zoom</p>
        </div>
      </div>
    </div>
  )
}

/* ── Panels ─────────────────────────────────────────────────────── */
function ModelPanel({ garment, onPick }: { garment: GarmentId; onPick: (g: GarmentId) => void }) {
  return (
    <Section title="Choose a model" sub="Cloth-simulated pattern geometry, every panel editable.">
      <div className="grid grid-cols-2 gap-2">
        {(Object.values(GARMENTS)).map((g) => (
          <button key={g.id} onClick={() => onPick(g.id)} aria-label={g.label} className={cn('overflow-hidden rounded-xl border text-left transition-colors', garment === g.id ? 'border-ink ring-1 ring-ink' : 'border-line-strong hover:border-fg/30')}>
            <img src={`${import.meta.env.BASE_URL}studio/thumb-${g.id}.jpg`} alt="" loading="lazy" className="aspect-square w-full bg-surface-2 object-cover" />
            <span className="block px-3 py-2.5">
              <span className="block text-[13px] font-semibold">{g.label}</span>
              <span className="block text-[11px] text-muted">{g.parts.length} parts</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">Change lengths in the Fit tab. Each model keeps its own design while you switch.</p>
    </Section>
  )
}

function ColorPanel() {
  const garment = useStudio((s) => s.garment)
  const design = useStudio((s) => s.designs[s.garment])
  const selection = useStudio((s) => s.selection)
  const { edit, select } = useStudio.getState()
  const parts = GARMENTS[garment].parts
  const clothIds = parts.filter((p) => p.kind === 'cloth').map((p) => p.id)
  const picked = selection.type === 'part' ? parts.find((p) => p.id === selection.id) : undefined
  const ids = picked ? [picked.id] : clothIds
  const style = design.parts[ids[0]]
  const kind = picked?.kind ?? 'cloth'
  const pat = style.pattern
  const key = ids.join(',')
  // "All fabric" recolors the thread with the cloth, so a black tee doesn't end up with white seams.
  const colorIds = picked ? ids : [...clothIds, ...parts.filter((p) => p.kind === 'thread').map((p) => p.id)]

  const uploadPattern = async (file?: File) => {
    if (!file) return
    const image = await shrinkImage(file, 1024)
    edit((d) => patchParts(d, ids, (p) => ({ pattern: { ...p.pattern, kind: 'image', image, scale: Math.max(p.pattern.scale, 0.2) } })))
  }

  return (
    <div className="space-y-7">
      <Section title="Part">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!picked} onClick={() => select({ type: 'all' })}>All fabric</Chip>
          {parts.map((p) => <Chip key={p.id} active={picked?.id === p.id} onClick={() => select({ type: 'part', id: p.id })}>{p.label}</Chip>)}
        </div>
      </Section>

      <Section title={kind === 'thread' ? 'Thread color' : kind === 'hardware' ? 'Hardware color' : 'Color'}>
        <ColorField value={style.color} onChange={(color) => edit((d) => patchParts(d, colorIds, () => ({ color })), `color:${key}`)} />
      </Section>

      {kind === 'hardware' && (
        <Section title="Material">
          <div className="flex gap-1.5">{HARDWARE.map((h) => <Chip key={h.id} active={style.hardware === h.id} onClick={() => edit((d) => patchParts(d, ids, () => ({ hardware: h.id })))}>{h.label}</Chip>)}</div>
        </Section>
      )}

      {kind === 'cloth' && (
        <>
          <Section title="Fabric">
            <div className="grid grid-cols-2 gap-1.5">
              {FABRICS.map((f) => (
                <button key={f.id} onClick={() => edit((d) => patchParts(d, ids, () => ({ fabric: f.id })))} className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors', style.fabric === f.id ? 'border-ink bg-surface-2' : 'border-line hover:border-fg/30')}>
                  <p className="text-[13px] font-semibold leading-tight">{f.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted">{f.note}</p>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Pattern">
            <div className="flex flex-wrap gap-1.5">
              {PATTERNS.filter((p) => p.id !== 'image').map((p) => <Chip key={p.id} active={pat.kind === p.id} onClick={() => edit((d) => patchParts(d, ids, (s) => ({ pattern: { ...s.pattern, kind: p.id as PatternKind } })))}>{p.label}</Chip>)}
              <FileChip active={pat.kind === 'image'} onFile={uploadPattern}>Your image</FileChip>
            </div>
            {pat.kind !== 'solid' && (
              <div className="mt-5 space-y-5">
                {pat.kind !== 'image' && <ColorField label="Second color" value={pat.color} onChange={(color) => edit((d) => patchParts(d, ids, (s) => ({ pattern: { ...s.pattern, color } })), `patc:${key}`)} />}
                <Slider label="Repeat size" unit="cm" min={2} max={60} step={0.5} value={pat.scale * 100} onChange={(v) => edit((d) => patchParts(d, ids, (s) => ({ pattern: { ...s.pattern, scale: v / 100 } })), `pats:${key}`)} />
                <Slider label="Angle" unit="°" min={-90} max={90} step={1} value={pat.angle} onChange={(v) => edit((d) => patchParts(d, ids, (s) => ({ pattern: { ...s.pattern, angle: v } })), `pata:${key}`)} />
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function ArtPanel({ engine, addLayer, onView }: { engine: React.RefObject<StudioEngine | null>; addLayer: (b: Partial<Layer> & Pick<Layer, 'kind' | 'name'>) => void; onView: (v: View) => void }) {
  const garment = useStudio((s) => s.garment)
  const design = useStudio((s) => s.designs[s.garment])
  const selection = useStudio((s) => s.selection)
  const brands = useAuth((s) => s.me?.user.brands ?? [])
  const { edit, select } = useStudio.getState()
  const layer = selection.type === 'layer' ? design.layers.find((l) => l.id === selection.id) : undefined
  const logo = brands.find((b) => b.logo)
  const patch = (p: Partial<Layer>, key?: string) => layer && edit((d) => patchLayer(d, layer.id, p), key && `${key}:${layer.id}`)

  const addImage = async (file?: File) => {
    if (!file) return
    try {
      const src = await shrinkImage(file, 1024)
      addLayer({ kind: 'image', name: file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Image', src, knockout: false })
    } catch {
      toast('That file could not be read as an image', { tone: 'error' })
    }
  }

  const move = (id: string, dir: -1 | 1) => edit((d) => {
    const i = d.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.layers.length) return d
    const layers = [...d.layers]
    ;[layers[i], layers[j]] = [layers[j], layers[i]]
    return { ...d, layers }
  })
  const remove = (id: string) => {
    edit((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }))
    if (selection.type === 'layer' && selection.id === id) select({ type: 'all' })
  }
  const duplicate = (l: Layer) => {
    if (design.layers.length >= MAX_LAYERS) return toast(`Up to ${MAX_LAYERS} artwork layers per garment`, { tone: 'error' })
    const copy = { ...l, id: uid(), name: `${l.name} copy`, p: [l.p[0] + 0.025, l.p[1] - 0.025, l.p[2]] as Layer['p'] }
    edit((d) => ({ ...d, layers: [...d.layers, copy] }))
    select({ type: 'layer', id: copy.id })
  }

  return (
    <div className="space-y-7">
      <Section title="Add artwork">
        <div className="grid grid-cols-2 gap-1.5">
          <AddButton icon={Type} onClick={() => addLayer({ kind: 'text', name: 'Text', text: brands[0]?.name ?? 'YOUR BRAND', font: 'Space Grotesk', weight: 700, tracking: 0, curve: 0, outline: 0, outlineColor: '#ffffff' })}>Text</AddButton>
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong text-[13px] font-semibold transition-colors hover:border-fg/30">
            <UploadIcon className="size-4" /> Upload
            <input type="file" accept="image/*" hidden onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {logo?.logo && <AddButton icon={ImagePlus} onClick={() => addLayer({ kind: 'image', name: `${logo.name} logo`, src: logo.logo! })}>Brand logo</AddButton>}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Shapes className="mr-1 size-4 shrink-0 text-muted" />
          {SHAPES.map((s) => (
            <button key={s.id} aria-label={`Add ${s.label}`} title={s.label} onClick={() => addLayer({ kind: 'shape', name: s.label, shape: s.id })} className="grid size-9 place-items-center rounded-lg border border-line text-fg transition-colors hover:border-fg/30">
              <svg viewBox="0 0 100 100" className="size-4 fill-current"><path fillRule="evenodd" d={s.path} /></svg>
            </button>
          ))}
        </div>
      </Section>

      {design.layers.length > 0 && (
        <Section title={`Layers · ${design.layers.length}/${MAX_LAYERS}`}>
          <ul className="space-y-1">
            {[...design.layers].reverse().map((l) => (
              <li key={l.id} className={cn('flex items-center gap-1 rounded-lg border pl-3 pr-1', selection.type === 'layer' && selection.id === l.id ? 'border-ink bg-surface-2' : 'border-line')}>
                <button onClick={() => select({ type: 'layer', id: l.id })} className={cn('h-9 min-w-0 flex-1 truncate text-left text-[13px] font-medium', !l.visible && 'text-faint')}>{l.kind === 'text' ? l.text?.split('\n')[0] || 'Text' : l.name}</button>
                <Mini label="Move up" onClick={() => move(l.id, 1)}><ChevronUp className="size-3.5" /></Mini>
                <Mini label="Move down" onClick={() => move(l.id, -1)}><ChevronDown className="size-3.5" /></Mini>
                <Mini label={l.visible ? 'Hide' : 'Show'} onClick={() => edit((d) => patchLayer(d, l.id, { visible: !l.visible }))}>{l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</Mini>
                <Mini label="Duplicate" onClick={() => duplicate(l)}><Copy className="size-3.5" /></Mini>
                <Mini label="Delete" onClick={() => remove(l.id)}><Trash2 className="size-3.5" /></Mini>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {layer ? (
        <>
          {layer.kind === 'text' && (
            <Section title="Text">
              <textarea aria-label="Text" value={layer.text} rows={2} maxLength={80} onChange={(e) => patch({ text: e.target.value }, 'text')} className="w-full resize-none rounded-lg border border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-gold" />
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {FONTS.map((f) => (
                  <button key={f.id} onClick={() => patch({ font: f.id })} style={{ fontFamily: `"${f.id}"` }} className={cn('h-10 truncate rounded-lg border px-2 text-[14px]', layer.font === f.id ? 'border-ink bg-surface-2' : 'border-line hover:border-fg/30')}>{f.label}</button>
                ))}
              </div>
              <div className="mt-5 space-y-5">
                <Slider label="Letter spacing" min={-0.08} max={0.5} step={0.01} value={layer.tracking ?? 0} format={(v) => v.toFixed(2)} onChange={(v) => patch({ tracking: v }, 'track')} />
                <Slider label="Arc" min={-1} max={1} step={0.02} value={layer.curve ?? 0} format={(v) => v.toFixed(2)} onChange={(v) => patch({ curve: v }, 'curve')} />
                <Slider label="Outline" min={0} max={0.08} step={0.002} value={layer.outline ?? 0} format={(v) => v.toFixed(3)} onChange={(v) => patch({ outline: v }, 'outline')} />
                {(layer.outline ?? 0) > 0 && <ColorField label="Outline color" value={layer.outlineColor ?? '#ffffff'} onChange={(c) => patch({ outlineColor: c }, 'outc')} />}
              </div>
            </Section>
          )}
          {layer.kind !== 'image' ? (
            <Section title="Color"><ColorField value={layer.color} onChange={(c) => patch({ color: c }, 'lcolor')} /></Section>
          ) : (
            <Section title="Image">
              <label className="flex items-center justify-between text-[13px] font-medium text-fg-2">
                Remove white background
                <input type="checkbox" checked={!!layer.knockout} onChange={(e) => patch({ knockout: e.target.checked })} className="size-4 accent-[var(--gold)]" />
              </label>
            </Section>
          )}
          <Section title="Technique">
            <div className="flex flex-wrap gap-1.5">{FINISHES.map((f) => <Chip key={f.id} active={layer.finish === f.id} onClick={() => patch({ finish: f.id })}>{f.label}</Chip>)}</div>
          </Section>
          <Section title="Placement" sub="Drag the artwork directly on the garment, or jump to a preset.">
            <div className="flex flex-wrap gap-1.5">
              {GARMENTS[garment].placements.map((p) => (
                <Chip key={p.id} onClick={() => {
                  const at = engine.current?.locate(p)
                  if (!at) return toast('Nothing to print on there at this length', { tone: 'error' })
                  patch({ ...at, size: p.size })
                  onView(p.side === 'back' ? 'back' : p.side === 'left' ? 'side' : p.side === 'right' ? 'sideR' : 'front')
                }}>{p.label}</Chip>
              ))}
            </div>
            <div className="mt-5 space-y-5">
              <Slider label="Width" unit="cm" min={1.5} max={60} step={0.5} value={layer.size * 100} onChange={(v) => patch({ size: v / 100 }, 'size')} />
              <Slider label="Rotation" unit="°" min={-180} max={180} step={1} value={normalizeDeg((layer.rotation * 180) / Math.PI)} onChange={(v) => patch({ rotation: (v * Math.PI) / 180 }, 'rot')} />
              <Slider label="Opacity" unit="%" min={5} max={100} step={1} value={layer.opacity * 100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} />
            </div>
          </Section>
        </>
      ) : design.layers.length > 0 ? <p className="text-[13px] text-muted">Select a layer to edit it, or click it on the garment.</p> : null}
    </div>
  )
}

function FitPanel() {
  const garment = useStudio((s) => s.garment)
  const design = useStudio((s) => s.designs[s.garment])
  const edit = useStudio.getState().edit
  const def = GARMENTS[garment]
  return (
    <div className="space-y-7">
      <Section title="Silhouette" sub="Scales the whole garment around its center.">
        <div className="space-y-5">
          <Slider label="Width" unit="%" min={85} max={130} step={1} value={design.fit * 100} onChange={(v) => edit((d) => ({ ...d, fit: v / 100 }), 'fit')} />
          <Slider label="Depth" unit="%" min={85} max={130} step={1} value={design.depth * 100} onChange={(v) => edit((d) => ({ ...d, depth: v / 100 }), 'depth')} />
        </div>
      </Section>
      <Section title="Lengths" sub="Cuts the garment and adds a finished hem.">
        <div className="space-y-5">
          <Slider label={def.lengthLabel} unit="%" min={0} max={100} step={1} value={design.length * 100} onChange={(v) => edit((d) => ({ ...d, length: v / 100 }), 'length')} />
          {def.sleeve && <Slider label="Sleeve length" unit="%" min={0} max={100} step={1} value={design.sleeve * 100} onChange={(v) => edit((d) => ({ ...d, sleeve: v / 100 }), 'sleeve')} />}
        </div>
      </Section>
    </div>
  )
}

const MOTION_OPTIONS = [
  { id: 'spin', label: 'Turntable' },
  { id: 'sway', label: 'Sway' },
  { id: 'float', label: 'Float' },
] as const

/** How the piece performs in the feed: its track and the way it moves. */
function ShowPanel() {
  const design = useStudio((s) => s.designs[s.garment])
  const edit = useStudio.getState().edit
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => () => player.stop(), [])

  const listen = (id: string) => {
    player.unlock()
    if (!player.enabled) player.setEnabled(true)
    const next = preview === id ? null : id
    setPreview(next)
    player.play(next)
  }

  return (
    <div className="space-y-7">
      <Section title="Sound" sub="Plays when this piece is on stage in the feed. No sound picked? We match your brand's style.">
        <ul className="space-y-1">
          {TRACKS.map((t) => {
            const picked = design.sound === t.id
            return (
              <li key={t.id} className={cn('flex items-center gap-1 rounded-lg border pl-1 pr-3', picked ? 'border-ink bg-surface-2' : 'border-line')}>
                <button aria-label={preview === t.id ? `Stop ${t.title}` : `Listen to ${t.title}`} onClick={() => listen(t.id)} className="grid size-9 shrink-0 place-items-center rounded-md text-fg-2 transition-colors hover:bg-surface-3">
                  {preview === t.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button onClick={() => edit((d) => ({ ...d, sound: picked ? undefined : t.id }))} className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className="truncate text-[13px] font-semibold">{t.title}</span>
                  <span className="shrink-0 text-[11px] text-muted">{picked ? 'Selected' : `${t.mood} · ${t.bpm}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title="Movement" sub="How the garment moves on the runway. It pulses with the beat either way.">
        <div className="flex gap-1.5">
          {MOTION_OPTIONS.map((m) => <Chip key={m.id} active={design.motion === m.id} onClick={() => edit((d) => ({ ...d, motion: d.motion === m.id ? undefined : m.id }))}>{m.label}</Chip>)}
        </div>
      </Section>
    </div>
  )
}

function ScenePanel({ light, backdrop, spin, onLight, onBackdrop, onSpin }: { light: Light; backdrop: string; spin: boolean; onLight: (l: Light) => void; onBackdrop: (color: string) => void; onSpin: (v: boolean) => void }) {
  return (
    <div className="space-y-7">
      <Section title="Lighting">
        <div className="flex gap-1.5">{(['studio', 'daylight', 'noir'] as Light[]).map((l) => <Chip key={l} active={light === l} onClick={() => onLight(l)}><span className="capitalize">{l}</span></Chip>)}</div>
      </Section>
      <Section title="Backdrop" sub="The color behind your garment in the product photos and the shop's 3D view.">
        <ColorField swatches={BACKDROPS} value={backdrop} onChange={onBackdrop} />
      </Section>
      <Section title="Turntable">
        <Chip active={spin} onClick={() => onSpin(!spin)}>{spin ? 'Spinning' : 'Spin garment'}</Chip>
      </Section>
    </div>
  )
}

/* ── Small parts ────────────────────────────────────────────────── */
function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
      {sub && <p className="-mt-1.5 mb-3 text-[12px] leading-relaxed text-muted">{sub}</p>}
      {children}
    </section>
  )
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={cn('h-8 rounded-full border px-3 text-[12px] font-medium transition-colors', active ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong text-fg-2 hover:border-fg/30')}>{children}</button>
}

function FileChip({ active, onFile, children }: { active?: boolean; onFile: (f?: File) => void; children: ReactNode }) {
  return (
    <label className={cn('flex h-8 cursor-pointer items-center rounded-full border px-3 text-[12px] font-medium transition-colors', active ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong text-fg-2 hover:border-fg/30')}>
      {children}
      <input type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
    </label>
  )
}

function AddButton({ icon: Icon, onClick, children }: { icon: typeof Type; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong text-[13px] font-semibold transition-colors hover:border-fg/30"><Icon className="size-4" /> {children}</button>
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-9 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent">{children}</button>
}

function Mini({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-fg">{children}</button>
}

function ColorField({ value, onChange, label, swatches = SWATCHES }: { value: string; onChange: (c: string) => void; label?: string; swatches?: string[] }) {
  return (
    <div>
      {label && <p className="mb-2.5 text-[13px] font-medium text-fg-2">{label}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((c) => (
          <button key={c} aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)} style={{ background: c }} className={cn('grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface', value === c ? 'ring-2 ring-fg' : 'ring-1 ring-line-strong')}>
            {value === c && <Check className={cn('size-3.5', isLight(c) ? 'text-black' : 'text-white')} strokeWidth={3} />}
          </button>
        ))}
      </div>
      <label className="mt-2.5 flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-line-strong pl-1.5 pr-3 text-[12px] font-medium tabular">
        <input type="color" aria-label="Custom color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0" />
        {value.toUpperCase()}
      </label>
    </div>
  )
}

function Slider({ label, unit = '', value, onChange, min, max, step, format }: { label: string; unit?: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-[13px] font-medium text-fg-2">
        {label}
        <span className="tabular text-muted">{format ? format(value) : Math.round(value * 10) / 10}{unit && ` ${unit}`}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--gold)]" />
    </label>
  )
}

const normalizeDeg = (d: number) => {
  const r = ((d + 180) % 360 + 360) % 360 - 180
  return Math.round(r)
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150
}

async function shrinkImage(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const cv = document.createElement('canvas')
    cv.width = Math.round(img.width * k)
    cv.height = Math.round(img.height * k)
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** One-page factory sheet: front, back and the full spec. */
async function techSheet(front: Blob, back: Blob, type: string, lines: string[]): Promise<Blob> {
  const W = 2000
  const H = 1500
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = '#fbf9f5'
  c.fillRect(0, 0, W, H)
  const bitmaps = await Promise.all([createImageBitmap(front), createImageBitmap(back)])
  bitmaps.forEach((b, i) => c.drawImage(b, 60 + i * 660, 150, 640, (640 * b.height) / b.width))
  c.fillStyle = '#16130e'
  c.font = '700 44px "Space Grotesk", sans-serif'
  c.fillText(`BrandMarket tech pack — ${type}`, 60, 95)
  c.font = '600 22px Inter, sans-serif'
  c.fillText('FRONT', 60, 1040)
  c.fillText('BACK', 720, 1040)
  c.font = '700 22px Inter, sans-serif'
  c.fillText('SPECIFICATION', 1400, 170)
  c.font = '400 23px Inter, sans-serif'
  let y = 215
  for (const line of lines) {
    let row = ''
    for (const word of line.split(' ')) {
      if (c.measureText(`${row}${word} `).width > 540) {
        c.fillText(row, 1400, y)
        y += 32
        row = ''
      }
      row += `${word} `
    }
    c.fillText(row, 1400, y)
    y += 46
  }
  c.fillStyle = '#776f61'
  c.font = '400 20px Inter, sans-serif'
  c.fillText(new Date().toISOString().slice(0, 10), 60, H - 50)
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not build the sheet')
  return blob
}
