import { useEffect, useRef, useState } from 'react'

export function useDebounced<T>(value: T, ms = 220) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Calls `onClose` on outside click or Escape while `open`. */
export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])
  return ref
}

/** Fires `cb` when the sentinel scrolls into view. */
export function useInView(cb: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver((es) => es[0].isIntersecting && cbRef.current(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return ref
}
