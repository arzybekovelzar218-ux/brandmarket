import { BadgeCheck } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Verified = ({ className }: { className?: string }) => (
  <BadgeCheck aria-label="Verified brand" className={cn('size-4 shrink-0 fill-gold text-surface', className)} strokeWidth={2.2} />
)
