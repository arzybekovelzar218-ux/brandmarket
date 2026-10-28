import { motion } from 'framer-motion'
import { LogIn, LogOut, Moon, Plus, Sun } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/cn'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { navFor, type NavItem } from './nav'

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
          isActive ? 'text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="sidebar-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-xl bg-surface-2" />
          )}
          <Icon className={cn('relative size-[18px]', isActive && 'text-gold')} strokeWidth={isActive ? 2.2 : 1.8} />
          <span className="relative">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const me = useAuth((s) => s.me)
  const logout = useAuth((s) => s.logout)
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { main, work: allWork } = navFor(me)
  const work = allWork.filter((i) => i.to !== '/create')

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-bg/60 backdrop-blur-xl px-4 pb-5 pt-6 lg:flex">
      <Logo className="px-2" />
      <Button variant="ink" className="mt-8 w-full" onClick={() => navigate(me ? '/create' : '/login', { state: { from: '/create' } })}>
        <Plus className="size-4" /> {me?.user.brands.length ? 'New drop' : 'Create your brand'}
      </Button>
      <nav className="mt-6 space-y-1">
        {main.map((i) => <Item key={i.to} item={i} />)}
      </nav>
      {work.length > 0 && (
        <>
          <p className="mb-2 mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Workspace</p>
          <nav className="space-y-1">{work.map((i) => <Item key={i.to} item={i} />)}</nav>
        </>
      )}

      <div className="mt-auto space-y-3">
        <button
          onClick={toggle}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun className="size-[18px]" strokeWidth={1.8} /> : <Moon className="size-[18px]" strokeWidth={1.8} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {me ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line p-3 transition-colors hover:bg-surface-2/60">
            <NavLink to={`/u/${me.user.username}`} className="flex min-w-0 flex-1 items-center gap-3" aria-label="Your profile">
            <Avatar src={me.user.avatar} name={me.user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{me.user.name}</div>
              <div className="truncate text-xs text-muted">@{me.user.username}</div>
            </div>
            </NavLink>
            <button
              onClick={() => { logout(); navigate('/') }}
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line p-4">
            <p className="font-display text-[15px] font-semibold">Start your brand</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">Design it. We make, ship and sell it.</p>
            <Button size="sm" variant="ink" className="mt-4 w-full" onClick={() => navigate('/login')}>
              <LogIn className="size-4" /> Sign in
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
