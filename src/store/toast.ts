import { create } from 'zustand'

export interface Toast { id: number; text: string; tone: 'default' | 'error'; action?: { label: string; onClick: () => void } }

let seq = 0

export const useToasts = create<{ items: Toast[]; dismiss: (id: number) => void }>((set) => ({
  items: [],
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action'] } = {}) {
  const id = ++seq
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone: opts.tone ?? 'default', action: opts.action }] }))
  setTimeout(() => useToasts.getState().dismiss(id), 3200)
}
