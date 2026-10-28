import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type CatalogQuery } from '../api/api'
import type { Facets, Product } from '../api/types'
import { FilterPanel, type Filters } from '../components/FilterPanel'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { Button } from '../components/ui/Button'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { money } from '../lib/format'
import { useDismiss, useInView } from '../lib/hooks'
import { fadeUp } from '../lib/motion'

const SORTS = [
  { id: 'popular', label: 'Most popular' },
  { id: 'new', label: 'Newest' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
]
const PAGE = 20

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const sort = params.get('sort') ?? 'popular'
  const filters: Filters = useMemo(
    () => ({
      size: params.get('size') ?? undefined,
      style: params.get('style') ?? undefined,
      min: params.get('min') ? Number(params.get('min')) : undefined,
      max: params.get('max') ? Number(params.get('max')) : undefined,
      stock: params.get('stock') === '1' || undefined,
    }),
    [params],
  )
  const activeCount = [filters.size, filters.style, filters.min ?? filters.max, filters.stock].filter((v) => v != null).length
  const browsing = !q && !type && activeCount === 0

  const [facets, setFacets] = useState<Facets | null>(null)
  const [trending, setTrending] = useState<Product[] | null>(null)
  const [items, setItems] = useState<Product[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    api.facets().then(setFacets).catch(() => {})
    api.home().then((h) => setTrending(h.trending.slice(0, 10))).catch(() => setTrending([]))
  }, [])

  const query: CatalogQuery = useMemo(
    () => ({
      q: q || undefined, type: type || undefined, sort, size: filters.size, style: filters.style,
      minPrice: filters.min, maxPrice: filters.max, inStock: filters.stock, pageSize: PAGE,
    }),
    [q, type, sort, filters],
  )

  // first page whenever the query changes
  const reqId = useRef(0)
  useEffect(() => {
    const id = ++reqId.current
    setItems(null)
    api
      .products({ ...query, page: 0 })
      .then((r) => {
        if (id !== reqId.current) return
        setItems(r.items); setTotal(r.total); setHasMore(r.hasMore); setPage(0)
      })
      .catch(() => id === reqId.current && (setItems([]), setHasMore(false)))
  }, [query])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const id = reqId.current
    setLoadingMore(true)
    api
      .products({ ...query, page: page + 1 })
      .then((r) => {
        if (id !== reqId.current) return
        setItems((l) => [...(l ?? []), ...r.items]); setHasMore(r.hasMore); setPage(page + 1)
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, query, page])

  const sentinel = useInView(loadMore, hasMore && !!items)

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: true })
  }
  const applyFilters = (f: Filters) =>
    update({ size: f.size, style: f.style, min: f.min?.toString(), max: f.max?.toString(), stock: f.stock ? '1' : undefined })

  const chips = [
    filters.size && { key: 'size', label: `Size ${filters.size}` },
    filters.style && { key: 'style', label: filters.style },
    (filters.min != null || filters.max != null) && {
      key: 'price',
      label: `${money(filters.min ?? facets?.minPrice ?? 0)} – ${money(filters.max ?? facets?.maxPrice ?? 0)}`,
    },
    filters.stock && { key: 'stock', label: 'In stock' },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <>
      {browsing && <TrendingRail items={trending} />}

      {/* Filter bar */}
      <div className="sticky top-16 z-20 border-b border-line glass">
        <Page className="flex h-[60px] items-center gap-3">
          <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pr-6 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:[mask-image:none]">
            {['', ...(facets?.types ?? [])].map((t) => (
              <button
                key={t || 'all'}
                onClick={() => update({ type: t || undefined })}
                className={cn(
                  'relative h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors',
                  type === t ? 'text-ink-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                )}
              >
                {type === t && <motion.span layoutId="type-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-full bg-ink" />}
                <span className="relative">{t || 'All'}</span>
              </button>
            ))}
            {!facets && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-9 w-20 shrink-0 rounded-full" />)}
          </div>
          <SortMenu value={sort} onChange={(s) => update({ sort: s === 'popular' ? undefined : s })} />
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="h-9">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-black">{activeCount}</span>}
          </Button>
        </Page>
      </div>

      <Page className="pt-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[28px] font-bold leading-none sm:text-[34px]">
              {q ? <>Results for “{q}”</> : type ? type : 'All pieces'}
            </h1>
            <p className="mt-2 text-[14px] text-muted tabular">
              {items ? `${total} ${total === 1 ? 'piece' : 'pieces'}` : 'Loading…'} · from independent Kyrgyz brands
            </p>
          </div>
          {(chips.length > 0 || q) && (
            <div className="flex flex-wrap items-center gap-2">
              {q && <Chip label={`“${q}”`} onRemove={() => update({ q: undefined })} />}
              {chips.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  onRemove={() =>
                    update(c.key === 'price' ? { min: undefined, max: undefined } : { [c.key]: undefined })
                  }
                />
              ))}
              <button onClick={() => update({ q: undefined, size: undefined, style: undefined, min: undefined, max: undefined, stock: undefined })} className="ml-1 text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
                Clear all
              </button>
            </div>
          )}
        </div>

        {items?.length === 0 ? (
          <div className="grid place-items-center py-28 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-surface-2"><SearchX className="size-6 text-muted" strokeWidth={1.5} /></div>
            <h2 className="mt-6 text-2xl font-bold">Nothing matches yet</h2>
            <p className="mt-2 max-w-sm text-[15px] text-muted">Try a different size or widen the price range — new drops land every week.</p>
            <Button variant="ink" className="mt-7" onClick={() => setParams({}, { replace: true })}>Reset filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4 min-[1400px]:grid-cols-5">
            {items
              ? items.map((p, i) => (
                  <motion.div key={p.id} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 5) * 0.05 }}>
                    <ProductCard product={p} />
                  </motion.div>
                ))
              : Array.from({ length: 10 }, (_, i) => <ProductCardSkeleton key={i} />)}
            {loadingMore && Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={`m${i}`} />)}
          </div>
        )}
        <div ref={sentinel} className="h-px" />
        {items && items.length > 0 && !hasMore && (
          <p className="mt-16 text-center text-[13px] text-faint">You've seen all {total} pieces</p>
        )}
      </Page>

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} facets={facets} value={filters} onApply={applyFilters} />
    </>
  )
}

function TrendingRail({ items }: { items: Product[] | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  if (items && items.length === 0) return null
  return (
    <section className="pb-8 pt-7">
      <Page className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">This week</p>
          <h2 className="mt-1.5 text-[22px] font-bold leading-none sm:text-2xl">Trending now</h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button variant="outline" size="icon-sm" aria-label="Scroll left" onClick={() => scroll(-1)}><ArrowLeft className="size-4" /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Scroll right" onClick={() => scroll(1)}><ArrowRight className="size-4" /></Button>
        </div>
      </Page>
      <div ref={ref} className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:scroll-px-6 sm:gap-5 sm:px-6 lg:scroll-px-10 lg:px-10">
        {items
          ? items.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-[44vw] max-w-[230px] shrink-0 snap-start sm:w-[210px]"
              >
                <ProductCard product={p} />
              </motion.div>
            ))
          : Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="w-[44vw] max-w-[230px] shrink-0 sm:w-[210px]"><ProductCardSkeleton /></div>
            ))}
      </div>
    </section>
  )
}

function SortMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const current = SORTS.find((s) => s.id === value) ?? SORTS[0]
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
        <span className="hidden text-muted md:inline">Sort:</span> <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">Sort</span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
          >
            {SORTS.map((s) => (
              <li key={s.id}>
                <button onClick={() => { onChange(s.id); setOpen(false) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-surface-2">
                  {s.label}
                  {s.id === value && <Check className="size-4 text-gold" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 pl-3.5 pr-1.5 text-[13px] font-medium">
    {label}
    <button onClick={onRemove} aria-label={`Remove ${label}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-fg">
      <X className="size-3" />
    </button>
  </span>
)
