/** Two-thumb range slider built from two native range inputs (keyboard + touch friendly). */
export function RangeSlider({
  min, max, step = 10, value, onChange,
}: { min: number; max: number; step?: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const [lo, hi] = value
  const pct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100
  const thumb =
    'pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent outline-none ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-soft [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold [&::-moz-range-thumb]:bg-surface'
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
      <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gold" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      <input type="range" aria-label="Minimum price" min={min} max={max} step={step} value={lo} onChange={(e) => onChange([Math.min(+e.target.value, hi - step), hi])} className={thumb} />
      <input type="range" aria-label="Maximum price" min={min} max={max} step={step} value={hi} onChange={(e) => onChange([lo, Math.max(+e.target.value, lo + step)])} className={thumb} />
    </div>
  )
}
