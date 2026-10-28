import { AnimatePresence, motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import type { Product } from '../api/types'
import { cn } from '../lib/cn'
import { money } from '../lib/format'
import { useGate } from '../lib/useGate'
import { useAuth } from '../store/auth'
import { toast } from '../store/toast'
import { Img } from './ui/Img'
import { Skeleton } from './ui/Skeleton'
import { MiniRating } from './ui/Stars'
import { Verified } from './ui/Verified'

export function HeartButton({
  active, onToggle, className, size = 18,
}: { active: boolean; onToggle: () => void; className?: string; size?: number }) {
  return (
    <motion.button
      type="button"
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={active}
      whileTap={{ scale: 0.82 }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={cn('grid place-items-center rounded-full transition-colors', !className?.includes('size-') && 'size-9', !className?.includes('absolute') && 'relative', className)}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-0 rounded-full bg-gold/40"
          />
        )}
      </AnimatePresence>
      <motion.span key={String(active)} initial={{ scale: active ? 0.5 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}>
        <Heart style={{ width: size, height: size }} className={active ? 'fill-gold text-gold' : 'text-current'} strokeWidth={1.8} />
      </motion.span>
    </motion.button>
  )
}

/** Optimistic favorite toggle shared by cards, product page and feed. */
export function useSave(p: Pick<Product, 'id' | 'saved'>) {
  const [saved, setSaved] = useState(p.saved)
  const gate = useGate()
  const patchCounts = useAuth((s) => s.patchCounts)
  const wishlistCount = useAuth((s) => s.me?.wishlistCount ?? 0)
  const toggle = gate(async () => {
    const next = !saved
    setSaved(next)
    patchCounts({ wishlistCount: Math.max(0, wishlistCount + (next ? 1 : -1)) })
    try {
      const r = await api.toggleWishlist(p.id)
      setSaved(r.active)
      if (r.active) toast('Saved to favorites')
    } catch {
      setSaved(!next)
      toast('Could not update favorites', { tone: 'error' })
    }
  })
  return [saved, toggle] as const
}

const badgeLabel = { NEW: 'New', HOT: 'Hot', WINNER: 'Winner' } as const

export function ProductCard({ product: p, className }: { product: Product; className?: string }) {
  const [saved, toggle] = useSave(p)
  const badge = p.badges[0]

  return (
    <Link to={`/p/${p.id}`} className={cn('group block', className)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2 transition-[transform,box-shadow] duration-500 ease-out-expo group-hover:-translate-y-1 group-hover:shadow-lift">
        <div className="absolute inset-0 transition-[opacity,transform] duration-700 ease-out-expo group-hover:scale-[1.04] group-hover:opacity-0">
          <Img src={p.images[0]} alt={p.name} className="size-full object-cover" />
        </div>
        <div className="absolute inset-0 scale-[1.04] opacity-0 transition-[opacity,transform] duration-700 ease-out-expo group-hover:scale-100 group-hover:opacity-100">
          <Img src={p.images[1] ?? p.images[0]} alt="" className="size-full object-cover" />
        </div>
        {badge && (
          <span
            className={cn(
              'absolute left-3 top-3 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em]',
              badge === 'HOT' ? 'bg-black text-white' : badge === 'WINNER' ? 'bg-gold text-black' : 'bg-white/90 text-black backdrop-blur',
            )}
          >
            {badgeLabel[badge]}
          </span>
        )}
        {!p.inStock && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
            Sold out
          </span>
        )}
        <HeartButton
          active={saved}
          onToggle={toggle}
          className="absolute right-2 top-2 text-black/75 hover:bg-white/80 hover:text-black hover:backdrop-blur"
        />
      </div>
      <div className="mt-3.5 space-y-1 px-0.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
          <span className="truncate">{p.brand.name}</span>
          {p.brand.verified && <Verified className="size-3.5" />}
        </div>
        <div className="truncate text-[13px] text-muted">{p.name}</div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="whitespace-nowrap text-[13px] font-semibold tabular">{money(p.price)}</span>
          <MiniRating rating={p.rating} className="text-[11px]" />
        </div>
      </div>
    </Link>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[3/4] rounded-xl" />
      <div className="mt-3.5 space-y-2 px-0.5">
        <Skeleton className="h-2.5 w-1/3 rounded-full" />
        <Skeleton className="h-3 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/4 rounded-full" />
      </div>
    </div>
  )
}
