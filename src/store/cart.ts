import { create } from 'zustand'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import type { Cart } from '../api/types'
import { useAuth } from './auth'
import { toast } from './toast'

interface CartState {
  cart: Cart | null
  open: boolean
  busy: boolean
  setOpen: (v: boolean) => void
  load: () => Promise<void>
  add: (b: { productId: number; size?: string | null; color?: string | null; quantity?: number }) => Promise<boolean>
  setQty: (itemId: number, qty: number) => Promise<void>
  remove: (itemId: number) => Promise<void>
  clear: () => void
}

const sync = (cart: Cart) => useAuth.getState().patchCounts({ cartCount: cart.count })

export const useCart = create<CartState>((set) => ({
  cart: null,
  open: false,
  busy: false,
  setOpen: (open) => set({ open }),
  load: async () => {
    try {
      const cart = await api.cart()
      set({ cart })
      sync(cart)
    } catch {
      /* guest or offline */
    }
  },
  add: async (b) => {
    set({ busy: true })
    try {
      const cart = await api.addToCart(b)
      set({ cart, busy: false })
      sync(cart)
      return true
    } catch (e) {
      set({ busy: false })
      toast(errorMessage(e, 'Could not add to cart'), { tone: 'error' })
      return false
    }
  },
  setQty: async (itemId, qty) => {
    try {
      const cart = await api.setQty(itemId, qty)
      set({ cart })
      sync(cart)
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    }
  },
  remove: async (itemId) => {
    try {
      const cart = await api.removeFromCart(itemId)
      set({ cart })
      sync(cart)
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    }
  },
  clear: () => set({ cart: null }),
}))
