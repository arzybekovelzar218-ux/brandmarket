import { useState } from 'react'
import { cn } from '../../lib/cn'
import { media } from '../../lib/url'

const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-24 text-3xl' }

export function Avatar({
  src, name, size = 'md', ring, className,
}: { src?: string | null; name: string; size?: keyof typeof sizes; ring?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display font-semibold text-fg-2',
        ring && 'ring-2 ring-gold ring-offset-2 ring-offset-bg',
        sizes[size],
        className,
      )}
    >
      {src && !failed ? (
        <img src={media(src)} alt={name} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
