import { motion } from 'framer-motion'
import { ease } from '../lib/motion'

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-wrap items-end justify-between gap-6 pb-10 pt-10 lg:pt-14">
      <div>
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{eyebrow}</p>}
        <h1 className="mt-2 text-[34px] font-bold leading-none sm:text-[44px]">{title}</h1>
        {sub && <p className="mt-3 text-[15px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2.5">{actions}</div>}
    </motion.div>
  )
}
