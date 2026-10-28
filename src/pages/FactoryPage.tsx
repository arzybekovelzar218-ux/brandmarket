import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Calendar, Flame, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import { STAGES, type Order, type Stage, type UserMini } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/cn'
import { money, timeAgo } from '../lib/format'
import { ease } from '../lib/motion'
import { STAGE_META } from '../lib/stages'
import { toast } from '../store/toast'

const DONE_LIMIT = 12

export default function FactoryPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [workers, setWorkers] = useState<UserMini[]>([])
  const [q, setQ] = useState('')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [dragging, setDragging] = useState<Order | null>(null)
  const [selected, setSelected] = useState<Order | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }))

  useEffect(() => {
    api.board().then(setOrders).catch(() => setOrders([]))
    api.workers().then(setWorkers).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (orders ?? []).filter(
      (o) =>
        (!urgentOnly || o.priority === 'URGENT') &&
        (!t || [o.code, o.product.name, o.product.brand.name, o.buyer.name].some((s) => s.toLowerCase().includes(t))),
    )
  }, [orders, q, urgentOnly])

  const columns = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s, [] as Order[]])) as Record<Stage, Order[]>
    for (const o of filtered) if (o.status !== 'CANCELLED') map[o.status].push(o)
    for (const s of STAGES) map[s].sort((a, b) => (s === 'DONE' ? b.statusChangedAt.localeCompare(a.statusChangedAt) : (a.priority === 'URGENT' ? -1 : 0) - (b.priority === 'URGENT' ? -1 : 0) || a.dueDate.localeCompare(b.dueDate)))
    return map
  }, [filtered])

  const inProgress = (orders ?? []).filter((o) => o.status !== 'DONE' && o.status !== 'CANCELLED').length
  const urgent = (orders ?? []).filter((o) => o.priority === 'URGENT' && o.status !== 'DONE').length

  const replace = (o: Order) => setOrders((l) => l?.map((x) => (x.id === o.id ? o : x)) ?? l)

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const order = orders?.find((o) => o.id === e.active.id)
    const to = e.over?.id as Stage | undefined
    if (!order || !to || to === order.status) return
    const prev = order
    replace({ ...order, status: to, stageIndex: STAGES.indexOf(to), statusChangedAt: new Date().toISOString() })
    try {
      replace(await api.moveOrder(order.id, to))
      toast(`#${order.code} → ${STAGE_META[to].label}`)
    } catch (err) {
      replace(prev)
      toast(errorMessage(err, 'Could not move order'), { tone: 'error' })
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="Factory CRM"
        title="Production floor"
        sub={orders ? <><span className="font-semibold text-fg tabular">{inProgress}</span> in production · <span className="font-semibold text-fg tabular">{urgent}</span> urgent · drag cards between stages</> : 'Loading board…'}
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order, product, buyer" className="h-11 w-56 rounded-full border border-line-strong bg-surface pl-10 pr-4 text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
            </div>
            <Button variant={urgentOnly ? 'ink' : 'outline'} onClick={() => setUrgentOnly((u) => !u)}><Flame className="size-4" /> Urgent</Button>
          </>
        }
      />

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragging(orders?.find((o) => o.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-8 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          {STAGES.map((s, i) => (
            <Column key={s} stage={s} index={i} orders={columns[s]} loading={!orders} onOpen={setSelected} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
          {dragging && <OrderCard order={dragging} overlay />}
        </DragOverlay>
      </DndContext>

      <OrderDrawer order={selected} workers={workers} onClose={() => setSelected(null)} onSaved={(o) => { replace(o); setSelected(o) }} />
    </div>
  )
}

function Column({ stage, index, orders, loading, onOpen }: { stage: Stage; index: number; orders: Order[]; loading: boolean; onOpen: (o: Order) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const meta = STAGE_META[stage]
  const shown = stage === 'DONE' ? orders.slice(0, DONE_LIMIT) : orders
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.5, ease }}
      ref={setNodeRef}
      className={cn('flex w-[284px] shrink-0 snap-start flex-col rounded-2xl border bg-surface-2/50 transition-colors', isOver ? 'border-gold/60 bg-gold-soft' : 'border-line')}
    >
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="size-2 rounded-full" style={{ background: meta.color }} />
        <h3 className="font-sans text-[14px] font-semibold tracking-normal">{meta.label}</h3>
        <span className="rounded-full bg-surface-3 px-2 text-[12px] font-semibold text-muted tabular">{orders.length}</span>
        <span className="ml-auto text-[11px] text-faint">{meta.hint}</span>
      </header>
      <div className="flex min-h-[200px] flex-1 flex-col gap-2.5 px-2.5 pb-3">
        {loading && [0, 1].map((i) => <Skeleton key={i} className="h-[132px] rounded-xl" />)}
        <AnimatePresence initial={false}>
          {shown.map((o) => <Draggable key={o.id} order={o} onOpen={onOpen} />)}
        </AnimatePresence>
        {!loading && orders.length === 0 && (
          <div className={cn('grid flex-1 place-items-center rounded-xl border border-dashed text-[12px] text-faint transition-colors', isOver ? 'border-gold' : 'border-line-strong')}>Drop here</div>
        )}
        {orders.length > shown.length && <p className="py-2 text-center text-[12px] text-muted">+{orders.length - shown.length} more completed</p>}
      </div>
    </motion.section>
  )
}

function Draggable({ order, onOpen }: { order: Order; onOpen: (o: Order) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id })
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: isDragging ? 0.35 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
      <div ref={setNodeRef} {...listeners} {...attributes} onClick={() => onOpen(order)} className="touch-manipulation">
        <OrderCard order={order} />
      </div>
    </motion.div>
  )
}

function OrderCard({ order: o, overlay }: { order: Order; overlay?: boolean }) {
  const overdue = o.status !== 'DONE' && new Date(o.dueDate) < new Date(new Date().toDateString())
  return (
    <div className={cn('cursor-grab rounded-xl border border-line bg-surface p-3 transition-shadow active:cursor-grabbing', overlay ? 'rotate-[2deg] shadow-lift' : 'shadow-soft hover:shadow-lift')}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted tabular">#{o.code}</span>
        {o.priority === 'URGENT' && <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-danger"><Flame className="size-3" /> Urgent</span>}
      </div>
      <div className="mt-2.5 flex gap-3">
        <Img src={o.product.image ?? undefined} className="h-14 w-11 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{o.product.name}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{o.product.brand.name}</p>
          <p className="mt-1 text-[12px] text-fg-2">{o.quantity}× {o.size && <>· {o.size}</>} {o.color && <span className="ml-1 inline-block size-2.5 rounded-full align-middle ring-1 ring-line-strong" style={{ background: o.color }} />}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <span className={cn('flex items-center gap-1 text-[11px] font-medium', overdue ? 'text-danger' : 'text-muted')}>
          {overdue ? <AlertTriangle className="size-3" /> : <Calendar className="size-3" />}
          {o.status === 'DONE' ? timeAgo(o.statusChangedAt) : new Date(o.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        {o.assignee ? <Avatar src={o.assignee.avatar} name={o.assignee.name} size="xs" /> : <span className="text-[11px] text-faint">Unassigned</span>}
      </div>
    </div>
  )
}

function OrderDrawer({ order, workers, onClose, onSaved }: { order: Order | null; workers: UserMini[]; onClose: () => void; onSaved: (o: Order) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setNote(order?.note ?? ''), [order?.id, order?.note])

  const patch = async (b: { priority?: string; assigneeId?: number; note?: string }) => {
    if (!order) return
    setBusy(true)
    try {
      onSaved(await api.patchOrder(order.id, b))
      toast('Order updated')
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {order && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.45, ease }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col overflow-y-auto bg-surface shadow-pop">
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="text-[13px] font-semibold text-muted">#{order.code}</span>
              <Button variant="soft" size="icon-sm" aria-label="Close" onClick={onClose}><X className="size-[18px]" /></Button>
            </div>
            <div className="px-6 pb-8">
              <div className="mt-4 flex gap-4">
                <Img src={order.product.image ?? undefined} className="h-28 w-[84px] rounded-xl object-cover" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{order.product.brand.name}</p>
                  <h2 className="mt-1 text-xl font-bold">{order.product.name}</h2>
                  <p className="mt-1 text-[14px] text-muted">{order.quantity}× · {order.size ?? 'One size'} · {money(order.total)}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
                    <span className="size-1.5 rounded-full" style={{ background: STAGE_META[order.status].color }} />{STAGE_META[order.status].label}
                  </span>
                </div>
              </div>

              <dl className="mt-8 space-y-3 rounded-2xl border border-line p-4 text-[14px]">
                <div className="flex justify-between gap-4"><dt className="text-muted">Customer</dt><dd className="flex items-center gap-2"><Avatar src={order.buyer.avatar} name={order.buyer.name} size="xs" />{order.buyer.name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Phone</dt><dd className="tabular">{order.phone ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Delivery</dt><dd className="text-right">{order.address ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Due</dt><dd>{new Date(order.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</dd></div>
              </dl>

              <h3 className="mb-3 mt-8 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">Priority</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['NORMAL', 'URGENT'] as const).map((p) => (
                  <button key={p} disabled={busy} onClick={() => patch({ priority: p })} className={cn('flex h-11 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium transition-colors', order.priority === p ? (p === 'URGENT' ? 'border-danger bg-danger text-white' : 'border-ink bg-ink text-ink-fg') : 'border-line-strong hover:border-fg/30')}>
                    {p === 'URGENT' && <Flame className="size-4" />}{p === 'URGENT' ? 'Urgent' : 'Normal'}
                  </button>
                ))}
              </div>

              <h3 className="mb-3 mt-8 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">Assignee</h3>
              <div className="flex flex-wrap gap-2">
                {workers.map((w) => (
                  <button key={w.id} disabled={busy} onClick={() => patch({ assigneeId: w.id })} className={cn('flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-[13px] font-medium transition-colors', order.assignee?.id === w.id ? 'border-gold bg-gold-soft' : 'border-line-strong hover:border-fg/30')}>
                    <Avatar src={w.avatar} name={w.name} size="xs" />{w.name.split(' ')[0]}
                  </button>
                ))}
              </div>

              <h3 className="mb-3 mt-8 font-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">Note</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Print on back, extra care with embroidery…" className="w-full resize-none rounded-xl border border-line-strong bg-bg p-3.5 text-[14px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
              <Button variant="ink" className="mt-3 w-full" disabled={busy || note === (order.note ?? '')} onClick={() => patch({ note })}>Save note</Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
