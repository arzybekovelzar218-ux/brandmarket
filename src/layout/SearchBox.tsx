import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import type { Suggestion } from '../api/types'
import { Img } from '../components/ui/Img'
import { cn } from '../lib/cn'
import { useDebounced, useDismiss } from '../lib/hooks'

const kindLabel = { BRAND: 'Brand', PRODUCT: 'Item', USER: 'Person' } as const
const popular = ['Hoodie', 'Oversized', 'Streetwear', 'Minimal', 'Pants']

export function SearchBox({ autoFocus, onDone, className }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const [params] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  useEffect(() => setQ(urlQ), [urlQ])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const debounced = useDebounced(q.trim(), 180)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)

  useEffect(() => {
    if (debounced.length < 2) return setItems([])
    let live = true
    api.suggest(debounced).then((r) => live && setItems(r.slice(0, 7))).catch(() => live && setItems([]))
    return () => { live = false }
  }, [debounced])

  const go = (link: string) => {
    setOpen(false)
    onDone?.()
    navigate(link)
  }
  const submit = (text = q) => {
    const t = text.trim()
    go(t ? `/?q=${encodeURIComponent(t)}` : '/')
  }
  const toLink = (s: Suggestion) => s.link

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && items[active]) go(toLink(items[active]))
          else submit()
        }}
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-full border bg-surface-2/70 px-4 transition-all duration-200',
          open ? 'border-line-strong bg-surface shadow-pop' : 'border-transparent hover:bg-surface-2',
        )}
      >
        <Search className="size-[18px] shrink-0 text-muted" strokeWidth={1.8} />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
          }}
          placeholder="Search brands, hoodies, styles…"
          aria-label="Search"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
        />
        {q && (
          <button type="button" aria-label="Clear" onClick={() => { setQ(''); setItems([]) }} className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-fg">
            <X className="size-3.5" />
          </button>
        )}
        <kbd className="hidden h-5 items-center rounded border border-line-strong px-1.5 font-sans text-[10px] font-medium text-faint xl:flex">/</kbd>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-pop"
          >
            {items.length > 0 ? (
              <ul role="listbox">
                {items.map((s, i) => (
                  <li key={`${s.kind}-${s.id}`}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(toLink(s))}
                      className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors', active === i && 'bg-surface-2')}
                    >
                      <Img src={s.image ?? undefined} className={cn('size-10 shrink-0 object-cover', s.kind === 'PRODUCT' ? 'rounded-lg' : 'rounded-full')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{s.title}</span>
                        {s.subtitle && <span className="block truncate text-xs text-muted">{s.subtitle}</span>}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{kindLabel[s.kind]}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button onClick={() => submit()} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-gold hover:bg-gold-soft">
                    See all results for “{q.trim()}” <ArrowUpRight className="size-4" />
                  </button>
                </li>
              </ul>
            ) : (
              <div className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{debounced.length >= 2 ? 'No matches — try' : 'Popular'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {popular.map((p) => (
                    <button key={p} onClick={() => { setQ(p); submit(p) }} className="h-8 rounded-full border border-line-strong px-3.5 text-[13px] text-fg-2 transition-colors hover:border-fg/30 hover:text-fg">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
