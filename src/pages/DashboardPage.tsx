import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import { STAGES, type Dashboard, type Point } from '../api/types'
import { BarsChart, Sparkline, TrendChart } from '../components/Charts'
import { PageHeader } from '../components/PageHeader'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Img } from '../components/ui/Img'
import { Skeleton } from '../components/ui/Skeleton'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { compact, money, timeAgo } from '../lib/format'
import { fadeUp, stagger } from '../lib/motion'
import { STAGE_META } from '../lib/stages'
import { useAuth } from '../store/auth'

const TILES: { key: string; label: string; series: keyof Point; format: (n: number) => string }[] = [
  { key: 'revenue', label: 'Revenue', series: 'revenue', format: money },
  { key: 'orders', label: 'Orders', series: 'orders', format: (n) => compact(n) },
  { key: 'views', label: 'Views', series: 'views', format: (n) => compact(n) },
  { key: 'followers', label: 'Followers', series: 'followers', format: (n) => compact(n) },
]

export default function DashboardPage() {
  const brands = useAuth((s) => s.me?.user.brands ?? [])
  const [brandId, setBrandId] = useState(brands[0]?.id)
  const [data, setData] = useState<Dashboard | null>(null)
  const [metric, setMetric] = useState(TILES[0])

  useEffect(() => {
    if (!brandId) return
    setData(null)
    api.dashboard(brandId).then(setData).catch(() => {})
  }, [brandId])

  const m = (k: string) => data?.metrics.find((x) => x.key === k)

  return (
    <Page>
      <PageHeader
        eyebrow="Brand studio"
        title={data?.brand.name ?? 'Dashboard'}
        sub="Last 30 days · updated live from your orders"
        actions={
          <>
            {brands.length > 1 && (
              <select value={brandId} onChange={(e) => setBrandId(Number(e.target.value))} className="h-11 rounded-full border border-line-strong bg-surface px-4 text-[14px] outline-none">
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {data && <Link to={`/b/${data.brand.slug}`}><Button variant="outline"><ExternalLink className="size-4" /> View profile</Button></Link>}
          </>
        }
      />

      {/* KPI tiles — also act as the chart's metric switch */}
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {TILES.map((t) => {
          const v = m(t.key)
          const up = (v?.delta ?? 0) >= 0
          return (
            <motion.button
              key={t.key}
              variants={fadeUp}
              onClick={() => setMetric(t)}
              className={cn(
                'rounded-2xl border bg-surface p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift',
                metric.key === t.key ? 'border-gold/60 ring-4 ring-gold/10' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted">{t.label}</p>
                {v?.delta != null && (
                  <span className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular', up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(v.delta).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="mt-3 whitespace-nowrap font-display text-[21px] font-bold leading-none tracking-[-0.03em] sm:text-[30px]">
                {v ? <AnimatedNumber value={v.value} format={t.format} /> : <Skeleton className="h-8 w-24" />}
              </div>
              <div className="mt-4 -mx-1">{data ? <Sparkline data={data.series} dataKey={t.series} /> : <div className="h-10" />}</div>
            </motion.button>
          )
        })}
      </motion.div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{metric.label}</h2>
              <p className="text-[13px] text-muted">Daily, last 30 days</p>
            </div>
            <div className="hidden gap-1 rounded-full bg-surface-2 p-1 sm:flex">
              {TILES.map((t) => (
                <button key={t.key} onClick={() => setMetric(t)} className={cn('relative h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors', metric.key === t.key ? 'text-fg' : 'text-muted hover:text-fg')}>
                  {metric.key === t.key && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-surface shadow-soft" />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">{data ? <TrendChart data={data.series} dataKey={metric.series} format={metric.format} /> : <Skeleton className="h-[300px]" />}</div>
        </Card>

        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Top pieces</h2>
          <p className="text-[13px] text-muted">By views this month</p>
          <ul className="mt-5 space-y-4">
            {data
              ? data.topProducts.slice(0, 5).map((t, i) => (
                  <li key={t.product.id}>
                    <Link to={`/p/${t.product.id}`} className="group flex items-center gap-3">
                      <span className="w-4 text-[13px] font-semibold text-faint tabular">{i + 1}</span>
                      <Img src={t.product.image ?? undefined} className="h-14 w-11 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium group-hover:underline">{t.product.name}</p>
                        <p className="text-xs text-muted tabular">{compact(t.views)} views · {t.sales} sold · {t.likes} likes</p>
                      </div>
                    </Link>
                  </li>
                ))
              : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold">Production pipeline</h2>
          <p className="text-[13px] text-muted">Your orders by factory stage</p>
          <div className="mt-6">
            {data ? (
              <BarsChart data={STAGES.map((s) => ({ label: STAGE_META[s].short, value: data.pipeline[s] ?? 0 }))} format={(n) => `${n} orders`} height={220} />
            ) : (
              <Skeleton className="h-[220px]" />
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
            {[['conversion', 'Conversion', (n: number) => `${n}%`], ['avgOrder', 'Avg. order', money], ['rating', 'Rating', (n: number) => `★ ${n.toFixed(1)}`]].map(([k, l, f]) => (
              <div key={k as string}>
                <p className="font-display text-lg font-bold tabular">{m(k as string) ? (f as (n: number) => string)(m(k as string)!.value) : '—'}</p>
                <p className="text-xs text-muted">{l as string}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-5 pb-3 sm:p-7 sm:pb-4">
            <h2 className="text-lg font-bold">Recent orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-y border-line text-[12px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-5 py-3 font-medium sm:px-7">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium sm:px-7">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data?.recentOrders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3.5 sm:px-7">
                      <div className="flex items-center gap-3">
                        <Img src={o.product.image ?? undefined} className="size-10 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{o.product.name}</p>
                          <p className="text-xs text-muted">#{o.code} · {timeAgo(o.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5"><span className="flex items-center gap-2"><Avatar src={o.buyer.avatar} name={o.buyer.name} size="xs" /><span className="truncate">{o.buyer.name}</span></span></td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
                        <span className="size-1.5 rounded-full" style={{ background: STAGE_META[o.status].color }} />
                        {STAGE_META[o.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular sm:px-7">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data && <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
          </div>
        </Card>
      </div>
    </Page>
  )
}
