import { Expand, Loader2, Minimize, Move3D } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { backdropCss, DEFAULT_BACKDROP, FONT_CSS } from '../studio/catalog'
import { StudioEngine, type View } from '../studio/engine'
import { loadDesign } from '../studio/productDesign'

const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'three', label: '3/4' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
]

/** Read-only 3D view of a published garment. Lives in a lazy chunk: three.js loads only when a shopper asks for it. */
export default function Garment3D({ designRef, onFail }: { designRef: string; onFail: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<StudioEngine | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View | null>('three')
  const [full, setFull] = useState(false)
  const [backdrop, setBackdrop] = useState(DEFAULT_BACKDROP)
  const failed = useRef(onFail)
  failed.current = onFail

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_CSS
      document.head.appendChild(link)
    }
    let live = true
    let instance: StudioEngine | null = null
    try {
      instance = new StudioEngine(host.current!, {
        onPick: () => undefined,
        onMoveLayer: () => undefined,
        onMoveEnd: () => undefined,
        onOverlay: () => undefined,
        onLoading: (v) => live && setLoading(v),
        onOrbit: () => {
          if (!live) return
          setView(null)
          engine.current?.setAutoRotate(false)
        },
        onError: () => live && failed.current(),
      }, { interactive: false })
    } catch {
      failed.current()
      return
    }
    engine.current = instance
    instance.setEmbedded(true)
    instance.setAutoRotate(true)
    loadDesign(designRef)
      .then((design) => {
        if (!live) return
        if (design.backdrop) setBackdrop(design.backdrop)
        instance!.apply(design, null)
      })
      .catch(() => live && failed.current())
    return () => {
      live = false
      instance?.dispose()
      engine.current = null
    }
  }, [designRef])

  useEffect(() => {
    const sync = () => {
      const on = document.fullscreenElement === root.current
      setFull(on)
      engine.current?.setEmbedded(!on)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const go = (v: View) => {
    setView(v)
    engine.current?.setAutoRotate(false)
    engine.current?.setView(v)
  }

  return (
    <div ref={root} className="absolute inset-0" style={{ background: backdropCss(backdrop) }}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[13px] font-medium text-white"><Loader2 className="size-4 animate-spin" /> Loading 3D model</span>
        </div>
      )}
      <span className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[12px] font-medium text-black backdrop-blur">
        <Move3D className="size-3.5" /> {full ? 'Drag to rotate · scroll to zoom' : 'Drag to rotate'}
      </span>
      {document.fullscreenEnabled && (
        <button
          aria-label={full ? 'Exit full screen' : 'Full screen'}
          onClick={() => (full ? document.exitFullscreen() : root.current?.requestFullscreen())}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/85 text-black backdrop-blur transition-colors hover:bg-white"
        >
          {full ? <Minimize className="size-4" /> : <Expand className="size-4" />}
        </button>
      )}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white/85 p-1 shadow-soft backdrop-blur">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => go(v.id)} className={cn('h-8 rounded-full px-3 text-[12px] font-semibold text-black transition-colors', view === v.id ? 'bg-black text-white' : 'hover:bg-black/8')}>{v.label}</button>
        ))}
      </div>
    </div>
  )
}
