import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { useToasts } from '../store/toast'

export function Toasts() {
  const { items, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 pl-3 pr-5 text-[13px] font-medium text-ink-fg shadow-pop"
          >
            <span className={cn('grid size-6 place-items-center rounded-full', t.tone === 'error' ? 'bg-danger text-white' : 'bg-gold text-black')}>
              {t.tone === 'error' ? <AlertCircle className="size-3.5" /> : <Check className="size-3.5" strokeWidth={3} />}
            </span>
            {t.text}
            {t.action && (
              <button onClick={() => { t.action!.onClick(); dismiss(t.id) }} className="ml-1 font-semibold text-gold hover:underline">
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
