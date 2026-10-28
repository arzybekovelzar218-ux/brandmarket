import { create } from 'zustand'
import { api } from '../api/api'
import { TOKEN_KEY } from '../api/client'
import type { Me } from '../api/types'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const writeToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

interface AuthState {
  me: Me | null
  ready: boolean
  init: () => Promise<void>
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<Me>
  register: (b: { name: string; username: string; email: string; password: string }) => Promise<Me>
  logout: () => void
  patchCounts: (p: Partial<Pick<Me, 'cartCount' | 'wishlistCount' | 'unreadCount'>>) => void
}

export const useAuth = create<AuthState>((set, get) => ({
  me: null,
  ready: false,
  init: async () => {
    if (!readToken()) return set({ ready: true })
    try {
      set({ me: await api.me(), ready: true })
    } catch {
      writeToken(null)
      set({ me: null, ready: true })
    }
  },
  refresh: async () => {
    if (!get().me) return
    try {
      set({ me: await api.me() })
    } catch {
      /* keep current */
    }
  },
  login: async (email, password) => {
    const r = await api.login(email, password)
    writeToken(r.token)
    set({ me: r.me })
    return r.me
  },
  register: async (b) => {
    const r = await api.register(b)
    writeToken(r.token)
    set({ me: r.me })
    return r.me
  },
  logout: () => {
    writeToken(null)
    set({ me: null })
  },
  patchCounts: (p) => {
    const me = get().me
    if (me) set({ me: { ...me, ...p } })
  },
}))
