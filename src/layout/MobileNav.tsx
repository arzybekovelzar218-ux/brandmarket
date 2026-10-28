import { motion } from 'framer-motion'
import { Heart, Play, Plus, Store, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useAuth } from '../store/auth'

export function MobileNav({ dark }: { dark?: boolean }) {
  const me = useAuth((s) => s.me)
  const items: { to: string; label: string; icon: typeof Store; end?: boolean; create?: boolean }[] = [
    { to: '/', label: 'Shop', icon: Store, end: true },
    { to: '/feed', label: 'Feed', icon: Play },
    { to: me ? '/create' : '/login', label: 'Create', icon: Plus, create: true },
    { to: '/favorites', label: 'Saved', icon: Heart },
    { to: me ? `/u/${me.user.username}` : '/login', label: me ? 'Me' : 'Sign in', icon: User },
  ]
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden',
        dark ? 'border-white/10 bg-black/80 text-white backdrop-blur-xl' : 'glass border-line',
      )}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, end, create }) => (
          <NavLink key={label} to={to} end={end} className="relative flex flex-col items-center justify-center gap-1">
            {({ isActive }) => create ? (
              <span className="grid h-9 w-12 place-items-center rounded-xl bg-gold text-black shadow-gold">
                <Icon className="size-5" strokeWidth={2.4} />
              </span>
            ) : (
              <>
                {isActive && <motion.span layoutId="mnav-dot" className="absolute top-1.5 size-1 rounded-full bg-gold" />}
                <Icon className={cn('size-[22px] transition-colors', isActive ? (dark ? 'text-white' : 'text-fg') : dark ? 'text-white/55' : 'text-muted')} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className={cn('text-[10px] font-medium', isActive ? (dark ? 'text-white' : 'text-fg') : dark ? 'text-white/55' : 'text-muted')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
