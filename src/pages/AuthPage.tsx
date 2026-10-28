import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Factory, Lock, Mail, Shirt, ShieldCheck, ShoppingBag, User } from 'lucide-react'
import { AxiosError } from 'axios'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Input } from '../components/ui/Input'
import { cn } from '../lib/cn'
import { ease } from '../lib/motion'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'

const DEMO = [
  { label: 'Shopper', email: 'aida@brandmarket.kg', password: 'demo123', icon: ShoppingBag },
  { label: 'Creator', email: 'airu@brandmarket.kg', password: 'pass123', icon: Shirt },
  { label: 'Factory', email: 'worker@brandmarket.kg', password: 'worker123', icon: Factory },
  { label: 'Admin', email: 'admin@brandmarket.kg', password: 'admin123', icon: ShieldCheck },
]

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const login = useAuth((s) => s.login)
  const register = useAuth((s) => s.register)
  const loadCart = useCart((s) => s.load)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const done = (onboarded: boolean, role: string) => {
    loadCart()
    if (!onboarded && role === 'USER') navigate('/welcome', { replace: true, state: { from } })
    else navigate(from, { replace: true })
  }

  /** Sign-up asks only name, email, password; the handle is derived from the email. */
  const registerSimple = async () => {
    const base = (form.email.split('@')[0] || form.name).toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 16).padEnd(3, '0')
    for (let attempt = 0; ; attempt++) {
      const username = attempt === 0 ? base : `${base}${Math.floor(100 + Math.random() * 9900)}`
      try {
        return await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, username })
      } catch (e) {
        const taken = e instanceof AxiosError && /username/i.test(String((e.response?.data as { message?: string })?.message))
        if (!taken || attempt >= 4) throw e
      }
    }
  }

  const submit = async (e?: React.FormEvent, demo?: (typeof DEMO)[number]) => {
    e?.preventDefault()
    setError('')
    setBusy(demo?.label ?? 'form')
    try {
      const me =
        demo ? await login(demo.email, demo.password)
        : mode === 'login' ? await login(form.email, form.password)
        : await registerSimple()
      done(me.user.onboarded, me.user.role)
    } catch (err) {
      setError(errorMessage(err, mode === 'login' ? 'Wrong email or password' : 'Could not create account'))
      setBusy(null)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* Form */}
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/" className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-4" /> Back to shop
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14">
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease }}>
              <h1 className="text-[36px] font-bold leading-[1.05] sm:text-[42px]">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
              <p className="mt-3 text-[15px] text-muted">
                {mode === 'login' ? 'Sign in to save pieces, follow brands and check out.' : 'Three fields and you\'re in. Takes 10 seconds.'}
              </p>

              <form onSubmit={submit} className="mt-10 space-y-4">
                {mode === 'register' && (
                  <Input id="name" label="Your name" icon={<User />} placeholder="Aida Karimova" value={form.name} onChange={set('name')} required maxLength={60} autoComplete="name" autoFocus />
                )}
                <Input id="email" type="email" label="Email" icon={<Mail />} placeholder="you@email.com" value={form.email} onChange={set('email')} required autoComplete="email" />
                <div className="relative">
                  <Input id="password" type={showPw ? 'text' : 'password'} label="Password" icon={<Lock />} placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'} value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 6 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="pr-12" />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute bottom-0 right-1 grid size-12 place-items-center text-muted hover:text-fg">
                    {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[13px] text-danger">
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <Button type="submit" variant="ink" size="lg" className="w-full" loading={busy === 'form'}>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <p className="mt-6 text-center text-[14px] text-muted">
                {mode === 'login' ? 'New to BrandMarket? ' : 'Already have an account? '}
                <Link to={mode === 'login' ? '/register' : '/login'} state={{ from }} className="font-semibold text-fg underline-offset-4 hover:underline">
                  {mode === 'login' ? 'Create an account' : 'Sign in'}
                </Link>
              </p>

              {mode === 'login' && (
                <div className="mt-12">
                  <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                    <span className="h-px flex-1 bg-line" /> Demo accounts · one click <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    {DEMO.map((d) => (
                      <button
                        key={d.label}
                        disabled={!!busy}
                        onClick={() => submit(undefined, d)}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl border border-line-strong p-3 text-left transition-all hover:border-gold/60 hover:bg-gold-soft disabled:opacity-50',
                          busy === d.label && 'border-gold bg-gold-soft',
                        )}
                      >
                        <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-gold group-hover:text-black">
                          <d.icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold">{d.label}</span>
                          <span className="block truncate text-[11px] text-muted">{d.email}</span>
                          <span className="block text-[11px] text-faint">pass: {d.password}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="text-center text-xs text-faint lg:text-left">© 2026 BrandMarket · Made in Bishkek</p>
      </div>

      {/* Visual */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 grid grid-cols-2 gap-3 p-3">
          {[
            ['https://images.pexels.com/photos/16551234/pexels-photo-16551234.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop', 'https://images.pexels.com/photos/30257619/pexels-photo-30257619.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop'],
            ['https://images.pexels.com/photos/9558567/pexels-photo-9558567.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop', 'https://images.pexels.com/photos/5365474/pexels-photo-5365474.jpeg?auto=compress&cs=tinysrgb&w=600&h=800&fit=crop'],
          ].map((col, c) => (
            <div key={c} className={cn('flex flex-col gap-3', c ? 'translate-y-[8%]' : '-translate-y-[4%]')}>
              {col.map((src, i) => (
                <motion.div
                  key={src}
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + (c * 2 + i) * 0.1, duration: 1.1, ease }}
                  className="h-[56%] shrink-0 overflow-hidden rounded-2xl bg-surface-3"
                >
                  <Img src={src} className="size-full object-cover" />
                </motion.div>
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <div className="flex -space-x-2">
            {[47, 12, 33, 5].map((n) => (
              <img key={n} src={`https://i.pravatar.cc/80?img=${n}`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} className="size-9 rounded-full object-cover ring-2 ring-black" />
            ))}
          </div>
          <p className="mt-5 max-w-sm font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]">16 independent brands. Every piece made to order in Bishkek.</p>
        </div>
      </div>
    </div>
  )
}
