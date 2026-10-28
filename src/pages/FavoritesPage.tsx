import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import type { Product } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { Button } from '../components/ui/Button'
import { Page } from '../layout/AppShell'
import { fadeUp, stagger } from '../lib/motion'
import { useAuth } from '../store/auth'

export default function FavoritesPage() {
  const me = useAuth((s) => s.me)
  const ready = useAuth((s) => s.ready)
  const [items, setItems] = useState<Product[] | null>(null)

  useEffect(() => {
    if (me) api.wishlist().then(setItems).catch(() => setItems([]))
  }, [me])

  if (ready && !me)
    return (
      <Page>
        <Empty title="Save what you love" text="Sign in to keep a list of pieces and come back to them anytime." cta={<Link to="/login" state={{ from: '/favorites' }}><Button variant="ink">Sign in</Button></Link>} />
      </Page>
    )

  return (
    <Page>
      <PageHeader eyebrow="Your edit" title="Favorites" sub={items ? `${items.length} saved ${items.length === 1 ? 'piece' : 'pieces'}` : ' '} />
      {items?.length === 0 ? (
        <Empty title="Nothing saved yet" text="Tap the heart on any piece to keep it here." cta={<Link to="/"><Button variant="ink">Browse the shop</Button></Link>} />
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4 min-[1400px]:grid-cols-5">
          {items ? items.map((p) => <motion.div key={p.id} variants={fadeUp}><ProductCard product={p} /></motion.div>) : Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </motion.div>
      )}
    </Page>
  )
}

export function Empty({ title, text, cta, icon: Icon = Heart }: { title: string; text: string; cta?: React.ReactNode; icon?: typeof Heart }) {
  return (
    <div className="grid place-items-center py-28 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-surface-2"><Icon className="size-6 text-muted" strokeWidth={1.5} /></div>
      <h2 className="mt-6 text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-[15px] text-muted">{text}</p>
      {cta && <div className="mt-7">{cta}</div>}
    </div>
  )
}
