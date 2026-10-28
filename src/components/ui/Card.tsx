import { cn } from '../../lib/cn'

export function Card({
  className, interactive, children, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-soft',
        interactive && 'transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
