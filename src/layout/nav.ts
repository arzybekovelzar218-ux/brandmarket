import { Factory, Heart, LayoutDashboard, Play, Plus, Receipt, ShieldCheck, Store, type LucideIcon } from 'lucide-react'
import type { Me } from '../api/types'

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export function navFor(me: Me | null): { main: NavItem[]; work: NavItem[] } {
  const main: NavItem[] = [
    { to: '/', label: 'Shop', icon: Store, end: true },
    { to: '/feed', label: 'Feed', icon: Play },
    { to: '/favorites', label: 'Favorites', icon: Heart },
  ]
  if (me) main.push({ to: '/orders', label: 'Orders', icon: Receipt })
  const work: NavItem[] = []
  if (me) work.push({ to: '/create', label: me.user.brands.length ? 'New drop' : 'Create brand', icon: Plus })
  if (me?.user.brands.length) work.push({ to: '/dashboard', label: 'Brand studio', icon: LayoutDashboard })
  if (me && (me.user.role === 'WORKER' || me.user.role === 'ADMIN')) work.push({ to: '/factory', label: 'Factory', icon: Factory })
  if (me?.user.role === 'ADMIN') work.push({ to: '/admin', label: 'Admin', icon: ShieldCheck })
  return { main, work }
}
