import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { CartDrawer } from '../components/CartDrawer'
import { Toasts } from '../components/Toasts'
import { ease } from '../lib/motion'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const immersive = pathname.startsWith('/feed')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[248px]">
        {!immersive && <Header />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.45, ease }}
            className={immersive ? '' : 'pb-28 lg:pb-16'}
          >
            {outlet}
          </motion.main>
        </AnimatePresence>
      </div>
      <MobileNav dark={immersive} />
      <CartDrawer />
      <Toasts />
    </div>
  )
}

/** Standard page container: generous gutters, max width. */
export function Page({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>
}
