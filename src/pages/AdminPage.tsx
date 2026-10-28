import { motion } from 'framer-motion'
import { BadgeCheck, Check, Crown, Plus, Search, Timer, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import { STAGES, type AdminStats, type Brand, type Poll } from '../api/types'
import { BarsChart, TrendChart } from '../components/Charts'
import { PageHeader } from '../components/PageHeader'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Verified } from '../components/ui/Verified'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { compact, money } from '../lib/format'
import { fadeUp, stagger } from '../lib/motion'
import { STAGE_META } from '../lib/stages'
import { toast } from '../store/toast'

type Tab = 'overview' | 'brands' | 'events'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <Page>
      <PageHeader eyebrow="Admin" title="Platform" sub="Health of the marketplace, brand verification and community votes." />
      <div className="mb-8 flex gap-6 border-b border-line">
        {(['overview', 'brands', 'events'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('relative pb-4 text-[14px] font-semibold capitalize transition-colors', tab === t ? 'text-fg' : 'text-muted hover:text-fg')}>
            {{ overview: 'Overview', brands: 'Brands', events: 'Votes' }[t]}
            {tab === t && <motion.span layoutId="admin-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-fg" />}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'brands' && <Brands />}
      {tab === 'events' && <Events />}
    </Page>
  )
}

function Overview() {
  const [s, setS] = useState<AdminStats | null>(null)
  useEffect(() => { api.adminStats().then(setS).catch(() => {}) }, [])

  const tiles = [
    { label: 'Revenue', value: s?.revenue, f: (n: number) => `${compact(n)} som` },
    { label: 'Orders', value: s?.orders, f: compact },
    { label: 'Users', value: s?.users, f: compact },
    { label: 'Brands', value: s?.brands, f: compact, sub: s && `${s.verifiedBrands} verified` },
    { label: 'Products', value: s?.products, f: compact },
    { label: 'In production', value: s ? s.orders - (s.ordersByStatus.DONE ?? 0) : undefined, f: compact },
  ]

  return (
    <>
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <motion.div key={t.label} variants={fadeUp}>
            <Card className="p-5">
              <p className="text-[13px] font-medium text-muted">{t.label}</p>
              <div className="mt-3 font-display text-[26px] font-bold leading-none tracking-[-0.03em]">
                {t.value != null ? <AnimatedNumber value={t.value} format={(n) => t.f(n)} /> : <Skeleton className="h-7 w-20" />}
              </div>
              {t.sub && <p className="mt-2 text-xs text-muted">{t.sub}</p>}
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Revenue</h2>
          <p className="text-[13px] text-muted">All brands, last 30 days</p>
          <div className="mt-6">{s ? <TrendChart data={s.series} dataKey="revenue" format={money} /> : <Skeleton className="h-[300px]" />}</div>
        </Card>
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Orders in production</h2>
          <p className="text-[13px] text-muted">By stage, excluding delivered</p>
          <div className="mt-6">
            {s ? <BarsChart data={STAGES.filter((x) => x !== 'DONE').map((x) => ({ label: STAGE_META[x].short, value: s.ordersByStatus[x] ?? 0 }))} format={(n) => `${n} orders`} height={300} /> : <Skeleton className="h-[300px]" />}
          </div>
        </Card>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="p-5 sm:p-7"><h2 className="text-lg font-bold">Top brands</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead>
              <tr className="border-y border-line text-[12px] uppercase tracking-[0.08em] text-muted">
                <th className="px-5 py-3 font-medium sm:px-7">Brand</th>
                <th className="px-3 py-3 text-right font-medium">Orders</th>
                <th className="px-3 py-3 text-right font-medium">Followers</th>
                <th className="px-5 py-3 text-right font-medium sm:px-7">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s?.topBrands.map((b, i) => (
                <tr key={b.brand.id} className="hover:bg-surface-2/60">
                  <td className="px-5 py-3.5 sm:px-7">
                    <Link to={`/b/${b.brand.slug}`} className="flex items-center gap-3">
                      <span className="w-4 text-[13px] text-faint tabular">{i + 1}</span>
                      <Avatar src={b.brand.logo} name={b.brand.name} size="sm" />
                      <span className="font-medium">{b.brand.name}</span>
                      {b.brand.verified && <Verified />}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-right tabular">{b.orders}</td>
                  <td className="px-3 py-3.5 text-right tabular">{b.followers}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular sm:px-7">{money(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Brands() {
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('pending')
  useEffect(() => { api.brands().then(setBrands).catch(() => setBrands([])) }, [])

  const list = useMemo(
    () => (brands ?? []).filter((b) => (filter === 'all' || (filter === 'verified') === b.verified) && b.name.toLowerCase().includes(q.toLowerCase())),
    [brands, q, filter],
  )
  const replace = (b: Brand) => setBrands((l) => l?.map((x) => (x.id === b.id ? b : x)) ?? l)

  const verify = async (b: Brand) => {
    replace({ ...b, verified: !b.verified })
    try {
      replace(await api.verify(b.id, !b.verified))
      toast(b.verified ? `${b.name} unverified` : `${b.name} is now verified`)
    } catch (e) {
      replace(b)
      toast(errorMessage(e), { tone: 'error' })
    }
  }
  const feature = async (b: Brand) => {
    try {
      await api.feature(b.id)
      toast(`${b.name} is brand of the day`)
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72"><Input icon={<Search />} placeholder="Search brands" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-full" /></div>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(['pending', 'verified', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('relative h-9 rounded-full px-4 text-[13px] font-medium capitalize', filter === f ? 'text-fg' : 'text-muted')}>
              {filter === f && <motion.span layoutId="brand-filter" className="absolute inset-0 rounded-full bg-surface shadow-soft" />}
              <span className="relative">{f} {brands && <span className="text-faint">{f === 'all' ? brands.length : brands.filter((b) => b.verified === (f === 'verified')).length}</span>}</span>
            </button>
          ))}
        </div>
      </div>
      <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {!brands && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}
        {list.map((b) => (
          <motion.div key={b.id} variants={fadeUp} layout>
            <Card className="flex items-center gap-4 p-4">
              <Avatar src={b.logo} name={b.name} size="lg" />
              <div className="min-w-0 flex-1">
                <Link to={`/b/${b.slug}`} className="flex items-center gap-1.5 font-semibold hover:underline">{b.name} {b.verified && <Verified />}</Link>
                <p className="truncate text-[13px] text-muted">{b.style} · {b.productsCount} pieces · {b.followers} followers</p>
                <p className="text-[13px] text-muted">by {b.owner.name}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant={b.verified ? 'outline' : 'primary'} onClick={() => verify(b)}>
                  {b.verified ? <><Check className="size-3.5" /> Verified</> : <><BadgeCheck className="size-3.5" /> Verify</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => feature(b)}><Crown className="size-3.5" /> Feature</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      {brands && list.length === 0 && <p className="py-16 text-center text-muted">{filter === 'pending' ? 'Every brand is verified.' : 'No brands match.'}</p>}
    </>
  )
}

function Events() {
  const [events, setEvents] = useState<Poll[] | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState({ title: '', description: '', prize: '', days: 7, brandIds: [] as number[] })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.events().then(setEvents).catch(() => setEvents([]))
    api.brands().then(setBrands).catch(() => {})
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.brandIds.length < 2) return toast('Pick at least 2 brands', { tone: 'error' })
    setBusy(true)
    try {
      const endsAt = new Date(Date.now() + form.days * 86400000).toISOString().slice(0, 19)
      const p = await api.createEvent({ title: form.title, description: form.description, prize: form.prize, endsAt, brandIds: form.brandIds })
      setEvents((l) => [p, ...(l ?? [])])
      setForm({ title: '', description: '', prize: '', days: 7, brandIds: [] })
      toast('Vote is live')
    } catch (err) {
      toast(errorMessage(err), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const close = async (p: Poll) => {
    try {
      const r = await api.closeEvent(p.id)
      setEvents((l) => l?.map((x) => (x.id === r.id ? r : x)) ?? l)
      toast(r.winner ? `${r.winner.name} wins` : 'Vote closed')
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="h-fit p-6">
        <h2 className="text-lg font-bold">New community vote</h2>
        <p className="text-[13px] text-muted">Shoppers vote; the winner gets the prize and a gold badge.</p>
        <form onSubmit={create} className="mt-6 space-y-4">
          <Input id="t" label="Title" placeholder="Brand of the month — November" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input id="d" label="Description" placeholder="Vote for the brand that defined the season" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input id="p" label="Prize" placeholder="Homepage feature + 50,000 som production credit" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} />
          <div>
            <p className="mb-2 text-[13px] font-medium text-fg-2">Duration</p>
            <div className="grid grid-cols-4 gap-2">
              {[3, 7, 14, 30].map((d) => (
                <button type="button" key={d} onClick={() => setForm({ ...form, days: d })} className={cn('h-10 rounded-xl border text-[13px] font-medium', form.days === d ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong')}>{d} days</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-fg-2">Brands <span className="text-muted">({form.brandIds.length} selected)</span></p>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {brands.map((b) => {
                const on = form.brandIds.includes(b.id)
                return (
                  <button type="button" key={b.id} onClick={() => setForm({ ...form, brandIds: on ? form.brandIds.filter((x) => x !== b.id) : [...form.brandIds, b.id] })} className={cn('flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-[13px] font-medium transition-colors', on ? 'border-gold bg-gold-soft' : 'border-line-strong hover:border-fg/30')}>
                    <Avatar src={b.logo} name={b.name} size="xs" className="size-7" />{b.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Button type="submit" variant="ink" className="w-full" loading={busy}><Plus className="size-4" /> Launch vote</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {!events && [0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        {events?.length === 0 && <p className="py-16 text-center text-muted">No votes yet — launch the first one.</p>}
        {events?.map((p) => (
          <Card key={p.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {p.active ? <Badge tone="success"><span className="size-1.5 animate-pulse rounded-full bg-success" /> Live</Badge> : <Badge>Closed</Badge>}
                  <span className="flex items-center gap-1 text-[13px] text-muted"><Timer className="size-3.5" /> {p.active ? `ends ${new Date(p.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'finished'}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
                {p.prize && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-gold"><Trophy className="size-3.5" /> {p.prize}</p>}
              </div>
              {p.active && <Button size="sm" variant="outline" onClick={() => close(p)}>Close & pick winner</Button>}
            </div>
            <ul className="mt-6 space-y-3">
              {p.options.map((o) => (
                <li key={o.id}>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="flex items-center gap-2.5 font-medium">
                      <Avatar src={o.brand.logo} name={o.brand.name} size="xs" />{o.brand.name}
                      {p.winner?.id === o.brand.id && <Crown className="size-4 text-gold" />}
                    </span>
                    <span className="text-muted tabular">{o.votes} · {o.percent.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${o.percent}%` }} transition={{ duration: 0.9 }} className={cn('h-full rounded-full', o.rank === 1 ? 'bg-gold' : 'bg-fg/25')} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-muted">{p.totalVotes} votes total</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
