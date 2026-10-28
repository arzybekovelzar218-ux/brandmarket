import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; label?: string; error?: string }
>(function Input({ icon, label, error, className, id, ...rest }, ref) {
  const field = (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-[18px]">{icon}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-[15px] text-fg placeholder:text-faint',
          'transition-[border-color,box-shadow] duration-200 outline-none',
          'hover:border-fg/25 focus:border-gold focus:ring-4 focus:ring-gold/15',
          icon && 'pl-11',
          error && 'border-danger focus:border-danger focus:ring-danger/15',
          className,
        )}
        {...rest}
      />
    </div>
  )
  if (!label && !error) return field
  return (
    <label htmlFor={id} className="block space-y-2">
      {label && <span className="text-[13px] font-medium text-fg-2">{label}</span>}
      {field}
      {error && <span className="text-[13px] text-danger">{error}</span>}
    </label>
  )
})
