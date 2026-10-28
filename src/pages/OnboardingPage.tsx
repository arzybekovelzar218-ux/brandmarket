import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { LogoMark } from '../components/Logo'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { cn } from '../lib/cn'
import { ease, fadeUp, stagger } from '../lib/motion'
import { useAuth } from '../store/auth'

const COVERS: Record<string, string> = {
  Streetwear: 'https://images.pexels.com/photos/30257619/pexels-photo-30257619.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Minimalism: 'https://images.pexels.com/photos/16037829/pexels-photo-16037829.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Casual: 'https://images.pexels.com/photos/9558898/pexels-photo-9558898.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Luxury: 'https://images.pexels.com/photos/32286461/pexels-photo-32286461.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Sport: 'https://images.pexels.com/photos/37056544/pexels-photo-37056544.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Vintage: 'https://images.pexels.com/photos/7389008/pexels-photo-7389008.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Grunge: 'https://images.pexels.com/photos/10024021/pexels-photo-10024021.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
  Y2K: 'https://images.pexels.com/photos/18556218/pexels-photo-18556218.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop',
}

export default function OnboardingPage() {
  const [styles, setStyles] = useState<string[]>(Object.keys(COVERS))
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const refresh = useAuth((s) => s.refresh)

  useEffect(() => { api.styles().then(setStyles).catch(() => {}) }, [])

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
  const finish = async (list: string[]) => {
    setBusy(true)
    try { await api.setInterests(list); await refresh() } catch { /* continue anyway */ }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-dvh px-5 pb-36 pt-10 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <LogoMark />
          <button onClick={() => finish([])} className="text-[14px] font-medium text-muted hover:text-fg">Skip</button>
        </div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }} className="mt-14 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Step 1 of 1</p>
          <h1 className="mt-3 text-[38px] font-bold leading-[1.02] sm:text-[52px]">What's your style?</h1>
          <p className="mt-4 text-[16px] text-muted">Pick a few — we'll tune your feed and shop to match. You can change this anytime.</p>
        </motion.div>
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {styles.map((s) => {
            const on = picked.includes(s)
            return (
              <motion.button
                key={s}
                variants={fadeUp}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(s)}
                className={cn('group relative aspect-[3/4] overflow-hidden rounded-2xl text-left ring-offset-4 ring-offset-bg transition-shadow', on && 'ring-2 ring-gold')}
              >
                <Img src={COVERS[s]} alt={s} className={cn('size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105', on && 'scale-105')} />
                <div className={cn('absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent transition-colors', on && 'bg-black/20')} />
                <span className="absolute bottom-4 left-4 font-display text-xl font-semibold text-white">{s}</span>
                <AnimatePresence>
                  {on && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-gold text-black">
                      <Check className="size-4" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )
          })}
        </motion.div>
      </div>
      <div className="glass fixed inset-x-0 bottom-0 border-t border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-10">
          <p className="text-[14px] text-muted"><span className="font-semibold text-fg tabular">{picked.length}</span> selected{picked.length < 2 && ' · pick at least 2'}</p>
          <Button variant="ink" size="lg" disabled={picked.length < 2} loading={busy} onClick={() => finish(picked)}>Continue</Button>
        </div>
      </div>
    </div>
  )
}
