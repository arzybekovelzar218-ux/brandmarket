import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** A finished 3D Studio design waiting to be published through the drop form. */
export interface PendingDesign {
  name: string
  type: string
  images: string[]
  colors: string[]
  description: string
  /** Where the 3D design was stored: see studio/productDesign.ts. */
  designRef?: string
  sound?: string
}

export const usePendingDesign = create<{ design: PendingDesign | null; set: (d: PendingDesign | null) => void }>()(
  persist((set) => ({ design: null, set: (design) => set({ design }) }), { name: 'bm.pending-design' }),
)
