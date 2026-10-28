import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Facets } from '../api/types'
import { cn } from '../lib/cn'
import { money } from '../lib/format'
import { ease } from '../lib/motion'
import { Button } from './ui/Button'
import { RangeSlider } from './ui/RangeSlider'

export interface Filters { size?: string; style?: string; min?: number; max?: number; stock?: boolean }

export function FilterPanel({
  open, onClose, facets, value, onApply,
}: { open: boolean; onClose: () => void; facets: Facets | null; value: Filters; onApply: (f: Filters) => void }) {
  const lo = Math.floor(facets?.minPrice ?? 0)
  const hi = Math.ceil(facets?.maxPrice ?? 10000)
  const [draft, setDraft] = useState<Filters>(value)
  const [range, setRange] = useState<[number, number]>([value.min ?? lo, value.max ?? hi])

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setRange([value.min ?? lo, value.max ?? hi])
  }, [open, value, lo, hi])

  const apply = () => {
    onApply({ ...draft, min: range[0] > lo ? range[0] : undefined, max: range[1] < hi ? range[1] : undefined })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
          <motion.aside
            role="dialog"
            aria-label="Filters"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.45, ease }}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface shadow-pop',
              'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none',
            )}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-surface-3 sm:hidden" />
            <div className="flex items-center justify-between px-6 pb-2 pt-5 sm:pt-6">
              <h2 className="text-2xl font-bold">Filters</h2>
              <Button variant="soft" size="icon-sm" aria-label="Close" onClick={onClose}><X className="size-[18px]" /></Button>
            </div>

            <div className="flex-1 space-y-9 overflow-y-auto px-6 py-6">
              <Group title="Price">
                <RangeSlider min={lo} max={hi} step={10} value={range} onChange={setRange} />
                <div className="mt-4 flex items-center justify-between text-[13px] font-medium tabular">
                  <span className="rounded-lg bg-surface-2 px-3 py-1.5">{money(range[0])}</span>
                  <span className="h-px w-6 bg-line-strong" />
                  <span className="rounded-lg bg-surface-2 px-3 py-1.5">{money(range[1])}</span>
                </div>
              </Group>

              <Group title="Size">
                <div className="grid grid-cols-4 gap-2">
                  {(facets?.sizes ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft((d) => ({ ...d, size: d.size === s ? undefined : s }))}
                      className={cn(
                        'h-11 rounded-xl border text-[14px] font-medium transition-colors',
                        draft.size === s ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong hover:border-fg/30',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="Style">
                <div className="flex flex-wrap gap-2">
                  {(facets?.styles ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft((d) => ({ ...d, style: d.style === s ? undefined : s }))}
                      className={cn(
                        'h-9 rounded-full border px-4 text-[13px] font-medium transition-colors',
                        draft.style === s ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong text-fg-2 hover:border-fg/30 hover:text-fg',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Group>

              <label className="flex cursor-pointer items-center justify-between">
                <span>
                  <span className="block text-[15px] font-semibold">In stock only</span>
                  <span className="text-[13px] text-muted">Hide sold-out pieces</span>
                </span>
                <button
                  role="switch"
                  aria-checked={!!draft.stock}
                  onClick={() => setDraft((d) => ({ ...d, stock: !d.stock }))}
                  className={cn('relative h-7 w-12 rounded-full transition-colors', draft.stock ? 'bg-gold' : 'bg-surface-3')}
                >
                  <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cn('absolute top-1 grid size-5 place-items-center rounded-full bg-white shadow-soft', draft.stock ? 'right-1' : 'left-1')}>
                    {draft.stock && <Check className="size-3 text-gold" strokeWidth={3} />}
                  </motion.span>
                </button>
              </label>
            </div>

            <div className="flex gap-3 border-t border-line px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setDraft({}); setRange([lo, hi]) }}>Reset</Button>
              <Button variant="ink" className="flex-[2]" onClick={apply}>Show results</Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="mb-4 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
    {children}
  </section>
)
