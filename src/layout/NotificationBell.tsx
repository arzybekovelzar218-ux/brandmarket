import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff, Heart, MessageCircle, Package, Star, Trophy, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import type { AppNotification, NotificationType } from '../api/types'
import { Avatar } from '../components/ui/Avatar'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/cn'
import { timeAgo } from '../lib/format'
import { useDismiss } from '../lib/hooks'
import { useAuth } from '../store/auth'

const icons: Record<NotificationType, typeof Bell> = {
  LIKE: Heart, FOLLOW: UserPlus, COMMENT: MessageCircle, NEW_ORDER: Package, ORDER_STATUS: Package, REVIEW: Star, EVENT: Trophy, SYSTEM: Bell,
}

export function NotificationBell() {
  const unread = useAuth((s) => s.me?.unreadCount ?? 0)
  const patchCounts = useAuth((s) => s.patchCounts)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    api.notifications().then(setItems).catch(() => setItems([]))
  }, [open])

  const readAll = () => {
    api.readAll().catch(() => {})
    patchCounts({ unreadCount: 0 })
    setItems((l) => l?.map((n) => ({ ...n, read: true })) ?? l)
  }

  return (
    <div ref={ref} className="relative">
      <HeaderIcon label="Notifications" onClick={() => setOpen((o) => !o)} active={open}>
        <motion.span animate={unread ? { rotate: [0, -14, 12, -8, 6, 0] } : {}} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 6 }} className="grid">
          <Bell className="size-5" strokeWidth={1.8} />
        </motion.span>
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-[17px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold leading-[17px] text-black ring-2 ring-bg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </HeaderIcon>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-3 top-[68px] z-50 origin-top-right overflow-hidden rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-[15px] font-semibold">Notifications</h3>
              {unread > 0 && <button onClick={readAll} className="text-[13px] font-medium text-gold hover:underline">Mark all read</button>}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {!items &&
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex gap-3 p-3"><Skeleton className="size-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-1/4" /></div></div>
                ))}
              {items?.length === 0 && (
                <div className="grid place-items-center gap-2 py-12 text-center text-muted">
                  <BellOff className="size-6" strokeWidth={1.5} />
                  <p className="text-[13px]">You're all caught up</p>
                </div>
              )}
              {items?.map((n) => {
                const Icon = icons[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (n.link) { setOpen(false); navigate(n.link) } }}
                    className="flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="relative">
                      <Avatar src={n.actor?.avatar ?? n.image} name={n.actor?.name ?? 'BrandMarket'} size="md" />
                      <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface ring-1 ring-line">
                        <Icon className="size-3 text-gold" strokeWidth={2.2} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('line-clamp-2 text-[13px] leading-snug', n.read ? 'text-muted' : 'text-fg')}>{n.message}</span>
                      <span className="mt-1 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function HeaderIcon({
  label, onClick, active, children, className,
}: { label: string; onClick?: () => void; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('relative grid size-10 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg', active && 'bg-surface-2 text-fg', className)}
    >
      {children}
    </motion.button>
  )
}
