import { animate, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

/** Counts up from 0 when scrolled into view. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-US'), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const fmt = useRef(format)
  fmt.current = format
  useEffect(() => {
    if (!inView || !ref.current) return
    const el = ref.current
    const c = animate(0, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = fmt.current(v)) })
    return () => c.stop()
  }, [inView, value])
  return <span ref={ref} className={className}>{format(0)}</span>
}
