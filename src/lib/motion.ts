import type { Transition, Variants } from 'framer-motion'

export const ease = [0.16, 1, 0.3, 1] as const
export const spring: Transition = { type: 'spring', stiffness: 380, damping: 30 }

/** Parent: staggers children that use `fadeUp`. */
export const stagger = (step = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step } },
})

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}
