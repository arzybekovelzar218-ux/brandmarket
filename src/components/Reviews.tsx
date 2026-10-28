import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquareText, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import type { Product, ReviewSummary } from '../api/types'
import { cn } from '../lib/cn'
import { timeAgo } from '../lib/format'
import { ease } from '../lib/motion'
import { useAuth } from '../store/auth'
import { toast } from '../store/toast'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Skeleton } from './ui/Skeleton'
import { Stars } from './ui/Stars'

export function Reviews({ product }: { product: Product }) {
  const [data, setData] = useState<ReviewSummary | null>(null)
  const [writing, setWriting] = useState(false)
  const me = useAuth((s) => s.me)

  const load = () => api.reviews(product.id).then(setData).catch(() => setData({ average: null, count: 0, histogram: {}, canReview: false, reviewed: false, items: [] }))
  useEffect(() => {
    load()
  }, [product.id])

  if (!data)
    return (
      <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
        <Skeleton className="h-56 rounded-2xl" />
        <div className="space-y-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    )

  return (
    <div className="grid gap-12 lg:grid-cols-[320px_1fr] lg:gap-20">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-[26px] font-bold sm:text-3xl">Reviews</h2>
        <div className="mt-6 flex items-end gap-4">
          <span className="font-display text-[64px] font-bold leading-none tracking-[-0.04em] tabular">{data.average?.toFixed(1) ?? '—'}</span>
          <div className="pb-2">
            <Stars value={data.average ?? 0} />
            <p className="mt-1 text-[13px] text-muted">{data.count} {data.count === 1 ? 'review' : 'reviews'}</p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = data.histogram[n] ?? 0
            const pct = data.count ? (c / data.count) * 100 : 0
            return (
              <div key={n} className="flex items-center gap-3 text-[13px]">
                <span className="w-3 text-muted tabular">{n}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} className="h-full rounded-full bg-gold" />
                </div>
                <span className="w-6 text-right text-muted tabular">{c}</span>
              </div>
            )
          })}
        </div>
        {data.canReview && !data.reviewed && !writing && (
          <Button variant="outline" className="mt-8 w-full" onClick={() => setWriting(true)}>Write a review</Button>
        )}
        {me && !data.canReview && !data.reviewed && (
          <p className="mt-8 text-[13px] text-muted">Only verified buyers can review — keeps ratings honest.</p>
        )}
      </div>

      <div>
        <AnimatePresence>
          {writing && <ReviewForm product={product} onDone={() => { setWriting(false); load() }} onCancel={() => setWriting(false)} />}
        </AnimatePresence>
        {data.items.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong py-16 text-center">
            <MessageSquareText className="size-6 text-faint" strokeWidth={1.5} />
            <p className="mt-3 font-display text-lg font-semibold">No reviews yet</p>
            <p className="mt-1 text-[14px] text-muted">Be the first to share how it fits.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 5) * 0.05, duration: 0.5, ease }} className="py-7 first:pt-0">
                <div className="flex items-center gap-3">
                  <Link to={`/u/${r.user.username}`}><Avatar src={r.user.avatar} name={r.user.name} size="md" /></Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/u/${r.user.username}`} className="text-[14px] font-semibold hover:underline">{r.user.name}</Link>
                    <p className="text-xs text-muted">{timeAgo(r.createdAt)}{r.size && <> · Size {r.size}</>} · Verified buyer</p>
                  </div>
                  <Stars value={r.rating} size={14} />
                </div>
                {r.text && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-2">{r.text}</p>}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ReviewForm({ product, onDone, onCancel }: { product: Product; onDone: () => void; onCancel: () => void }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState('')
  const [size, setSize] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await api.addReview(product.id, { rating, text, size })
      toast('Thanks for your review')
      onDone()
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mb-10 rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <p className="font-display text-lg font-semibold">How was it?</p>
        <div className="mt-4 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} whileTap={{ scale: 0.85 }} aria-label={`${n} stars`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>
              <Star className={cn('size-8 transition-colors', n <= (hover || rating) ? 'fill-gold text-gold' : 'text-surface-3')} />
            </motion.button>
          ))}
        </div>
        {product.sizes.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)} className={cn('h-9 rounded-full border px-4 text-[13px] font-medium', size === s ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong')}>
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Fit, fabric, how it washes…"
          className="mt-5 w-full resize-none rounded-xl border border-line-strong bg-bg p-4 text-[15px] outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="ink" disabled={!rating} loading={busy} onClick={submit}>Post review</Button>
        </div>
      </div>
    </motion.div>
  )
}
