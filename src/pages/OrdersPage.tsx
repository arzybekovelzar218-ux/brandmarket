import { motion } from 'framer-motion'
import { PartyPopper, Receipt, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/api'
import { STAGES, type Order } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Skeleton } from '../components/ui/Skeleton'
import { Page } from '../layout/AppShell'
import { money } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { STAGE_META } from '../lib/stages'
import { useCart } from '../store/cart'
import { toast } from '../store/toast'
import { Empty } from './FavoritesPage'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const placed = (useLocation().state as { placed?: boolean } | null)?.placed
  const { load, setOpen } = useCart()

  useEffect(() => { api.orders().then(setOrders).catch(() => setOrders([])) }, [])

  const reorder = async (o: Order) => {
    try {
      await api.addToCart({ productId: o.product.id, size: o.size, color: o.color, quantity: o.quantity })
      await load()
      setOpen(true)
    } catch {
      toast('Could not reorder', { tone: 'error' })
    }
  }

  return (
    <Page>
      <PageHeader eyebrow="Your purchases" title="Orders" sub="Track every piece from fabric to your door." />
      {placed && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-4 rounded-2xl border border-gold/30 bg-gold-soft p-5">
          <PartyPopper className="size-6 text-gold" />
          <div>
            <p className="font-semibold">Order placed!</p>
            <p className="text-[13px] text-muted">It's already on the factory board — you'll get a notification at every stage.</p>
          </div>
        </motion.div>
      )}
      {orders?.length === 0 && <Empty icon={Receipt} title="No orders yet" text="When you buy something, you can follow its production here." cta={<Link to="/"><Button variant="ink">Start shopping</Button></Link>} />}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-4">
        {!orders && [0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        {orders?.map((o) => {
          const meta = STAGE_META[o.status]
          const progress = o.status === 'CANCELLED' ? 0 : (o.stageIndex + 1) / STAGES.length
          return (
            <motion.div key={o.id} variants={fadeUp} className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
              <div className="flex gap-4 sm:gap-5">
                <Link to={`/p/${o.product.id}`} className="shrink-0"><Img src={o.product.image ?? undefined} className="h-24 w-[72px] rounded-xl object-cover" /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{o.product.brand.name}</p>
                      <p className="truncate text-[15px] font-medium">{o.product.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">#{o.code} · {o.quantity}×{o.size ? ` · Size ${o.size}` : ''} · {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <p className="font-display text-lg font-semibold tabular">{money(o.total)}</p>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-medium"><span className="size-2 rounded-full" style={{ background: meta.color }} />{meta.label}<span className="text-muted">· {meta.hint}</span></span>
                      {o.status === 'DONE' && <button onClick={() => reorder(o)} className="flex items-center gap-1.5 font-medium text-muted hover:text-fg"><RotateCcw className="size-3.5" /> Buy again</button>}
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1, ease, delay: 0.2 }} className="h-full rounded-full bg-gold" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </Page>
  )
}
