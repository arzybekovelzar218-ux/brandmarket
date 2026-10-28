import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Search, ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { useGate } from '../lib/useGate'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { HeaderIcon, NotificationBell } from './NotificationBell'
import { SearchBox } from './SearchBox'

export function Header() {
  const me = useAuth((s) => s.me)
  const cartCount = me?.cartCount ?? 0
  const setCartOpen = useCart((s) => s.setOpen)
  const gate = useGate()
  const navigate = useNavigate()
  const [mobileSearch, setMobileSearch] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setMobileSearch(false), [pathname])

  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-10">
        <Logo className="lg:hidden [&>span]:hidden sm:[&>span]:inline" />
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBox className="max-w-[560px]" />
        </div>
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1">
          <HeaderIcon label="Open search" onClick={() => setMobileSearch(true)} className="md:hidden">
            <Search className="size-5" strokeWidth={1.8} />
          </HeaderIcon>
          <HeaderIcon label="Favorites" onClick={() => navigate('/favorites')} className="hidden sm:grid">
            <Heart className="size-5" strokeWidth={1.8} />
            {(me?.wishlistCount ?? 0) > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-gold ring-2 ring-bg" />}
          </HeaderIcon>
          {me && <NotificationBell />}
          <HeaderIcon label="Cart" onClick={gate(() => setCartOpen(true))}>
            <ShoppingBag className="size-5" strokeWidth={1.8} />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                  className="absolute right-1 top-1 grid min-w-[17px] place-items-center rounded-full bg-ink px-1 text-[10px] font-bold leading-[17px] text-ink-fg ring-2 ring-bg"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </HeaderIcon>
          {me ? (
            <Link to={`/u/${me.user.username}`} aria-label="Your profile" className="ml-1.5 hidden rounded-full transition-opacity hover:opacity-80 sm:block lg:hidden">
              <Avatar src={me.user.avatar} name={me.user.name} size="sm" />
            </Link>
          ) : (
            <Button size="sm" variant="ink" className="ml-2 hidden sm:inline-flex lg:hidden" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mobileSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/95 px-4 pt-3 backdrop-blur-xl md:hidden"
          >
            <div className="flex items-center gap-2">
              <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
              <HeaderIcon label="Close search" onClick={() => setMobileSearch(false)}>
                <X className="size-5" />
              </HeaderIcon>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
