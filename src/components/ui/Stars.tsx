import { Star } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Compact rating: ★ 4.6 (12) */
export function MiniRating({ rating, count, className }: { rating: number | null; count?: number; className?: string }) {
  if (rating == null) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted tabular', className)}>
      <Star className="size-3 fill-gold text-gold" />
      <span className="font-medium text-fg-2">{rating.toFixed(1)}</span>
      {count != null && <span>({count})</span>}
    </span>
  )
}

export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-gold text-gold' : 'fill-surface-3 text-surface-3'} />
      ))}
    </span>
  )
}
