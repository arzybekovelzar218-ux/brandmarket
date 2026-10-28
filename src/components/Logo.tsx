import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#141416" className="dark:stroke-white/15" strokeWidth="2" />
      <path
        d="M20 16h14.5c6.4 0 10.5 3.3 10.5 8.4 0 3.4-1.9 5.9-5 7 3.9 1 6.3 3.9 6.3 7.9 0 5.7-4.5 8.7-11.5 8.7H20V16zm8 6.4v7h5.6c2.6 0 4-1.3 4-3.5s-1.4-3.5-4-3.5H28zm0 13v6.2h6.5c2.8 0 4.4-1.1 4.4-3.1s-1.6-3.1-4.4-3.1H28z"
        className="fill-gold"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)} aria-label="BrandMarket home">
      <LogoMark />
      <span className="font-display text-[19px] font-bold tracking-[-0.04em]">
        Brand<span className="text-muted">Market</span>
      </span>
    </Link>
  )
}
