import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const axis = { fontSize: 11, fill: 'var(--muted)' }
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Tip({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-[11px] text-muted">{label && shortDate(label)}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular">{format(payload[0].value)}</p>
    </div>
  )
}

/** Single-series area over time: thin 2px line, soft gold fill, crosshair tooltip. */
export function TrendChart({ data, dataKey, format, height = 300 }: { data: { date: string }[]; dataKey: string; format: (n: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} minTickGap={32} dy={8} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} width={44} />
        <Tooltip content={<Tip format={format} />} cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey={dataKey} stroke="var(--gold)" strokeWidth={2} fill={`url(#g-${dataKey})`} activeDot={{ r: 5, fill: 'var(--gold)', stroke: 'var(--surface)', strokeWidth: 2 }} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Sparkline({ data, dataKey }: { data: object[]; dataKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`s-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke="var(--gold)" strokeWidth={1.5} fill={`url(#s-${dataKey})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Single-series bars by category, 4px rounded tops. */
export function BarsChart({ data, format, height = 260 }: { data: { label: string; value: number }[]; format: (n: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: -16, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} dy={6} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
                <p className="text-[11px] text-muted">{label}</p>
                <p className="mt-0.5 text-[14px] font-semibold tabular">{format(Number(payload[0].value))}</p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  )
}
