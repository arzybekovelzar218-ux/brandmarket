import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'ink' | 'outline' | 'soft' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-white shadow-gold hover:bg-gold-hi active:bg-gold-lo dark:text-[#0e0b05]',
  ink: 'bg-ink text-ink-fg hover:opacity-90',
  outline: 'border border-line-strong bg-surface text-fg hover:border-fg/30 hover:bg-surface-2',
  soft: 'bg-surface-2 text-fg hover:bg-surface-3',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-[15px] gap-2.5',
  icon: 'size-11',
  'icon-sm': 'size-9',
  'icon-lg': 'size-13',
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: 'rounded' | 'pill'
  loading?: boolean
  children?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', shape = 'pill', loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-[-0.01em]',
        'transition-[background-color,border-color,color,opacity,box-shadow] duration-200',
        'disabled:pointer-events-none disabled:opacity-50',
        shape === 'pill' ? 'rounded-full' : size === 'sm' || size === 'icon-sm' ? 'rounded-[10px]' : 'rounded-xl',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </motion.button>
  )
})
