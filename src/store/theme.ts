import { create } from 'zustand'

type Theme = 'light' | 'dark'

const initial = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export const useTheme = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: initial(),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('bm-theme', theme)
    } catch {
      /* storage unavailable */
    }
    set({ theme })
  },
}))
