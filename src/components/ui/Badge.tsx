import { cn } from '../../lib/cn'

const tones = {
  neutral: 'bg-surface-2 text-fg-2',
  gold: 'bg-gold-soft text-gold',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  glass: 'glass text-fg shadow-soft',
  ink: 'bg-ink text-ink-fg',
}

export function Badge({
  tone = 'neutral', className, children,
}: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
