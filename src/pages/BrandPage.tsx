import { motion } from 'framer-motion'
import { Calendar, Grid3x3, Heart, MessageCircle, Share2, Star, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/api'
import type { Brand, Product } from '../api/types'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Skeleton } from '../components/ui/Skeleton'
import { Verified } from '../components/ui/Verified'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { pageUrl } from '../lib/url'
import { compact } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { useGate } from '../lib/useGate'
import { toast } from '../store/toast'

export default function BrandPage() {
  const { slug = '' } = useParams()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [view, setView] = useState<'grid' | 'shop'>('grid')
  const gate = useGate()

  useEffect(() => {
    setBrand(null); setProducts(null); setMissing(false)
    api.brand(slug).then(setBrand).catch(() => setMissing(true))
    api.brandProducts(slug).then(setProducts).catch(() => setProducts([]))
  }, [slug])

  const follow = gate(async () => {
    if (!brand) return
    const next = !brand.following
    setBrand({ ...brand, following: next, followers: brand.followers + (next ? 1 : -1) })
    try {
      const r = await api.follow(brand.id)
      setBrand((b) => b && { ...b, following: r.active, followers: r.count })
    } catch {
      setBrand((b) => b && { ...b, following: !next, followers: b.followers + (next ? -1 : 1) })
    }
  })

  const share = async () => {
    const url = pageUrl(`/b/${slug}`)
    try {
      if (navigator.share) await navigator.share({ title: brand?.name, url })
      else { await navigator.clipboard.writeText(url); toast('Link copied') }
    } catch { /* dismissed */ }
  }

  if (missing)
    return (
      <Page className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="text-3xl font-bold">Brand not found</h1>
          <Link to="/"><Button variant="ink" className="mt-6">Back to shop</Button></Link>
        </div>
      </Page>
    )

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[200px] overflow-hidden bg-surface-2 sm:h-[280px] lg:h-[320px]">
        {brand ? (
          <motion.div initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2, ease }} className="size-full">
            <Img src={brand.banner ?? brand.cover ?? undefined} className="size-full object-cover" />
          </motion.div>
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
      </div>

      <Page>
        <div className="relative -mt-16 flex flex-col gap-6 sm:-mt-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {brand ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 }}>
                <Avatar src={brand.logo} name={brand.name} size="xl" className="size-28 ring-[3px] ring-gold ring-offset-4 ring-offset-bg sm:size-36" />
              </motion.div>
            ) : (
              <Skeleton className="size-28 rounded-full sm:size-36" />
            )}
            <div className="pb-1">
              {brand ? (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-[34px] font-bold leading-none sm:text-[44px]">{brand.name}</h1>
                    {brand.verified && <Verified className="size-7" />}
                    {brand.winner && <Badge tone="gold"><Trophy className="size-3" /> Brand of the week</Badge>}
                  </div>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
                    <span>@{brand.slug}</span>
                    <span className="size-1 rounded-full bg-faint" />
                    <span>{brand.style}</span>
                    <span className="size-1 rounded-full bg-faint" />
                    <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Since {new Date(brand.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </p>
                </>
              ) : (
                <div className="space-y-3"><Skeleton className="h-10 w-56" /><Skeleton className="h-4 w-40" /></div>
              )}
            </div>
          </div>
          <div className="flex gap-2.5 pb-1">
            <Button variant={brand?.following ? 'outline' : 'ink'} className="min-w-[132px] flex-1 sm:flex-none" disabled={!brand} onClick={follow}>
              {brand?.following ? 'Following' : 'Follow'}
            </Button>
            <Button variant="outline" disabled={!brand} onClick={gate(() => toast(`Message sent to ${brand?.name} — they usually reply within a day`))}>
              <MessageCircle className="size-4" /> Message
            </Button>
            <Button variant="outline" size="icon" aria-label="Share" onClick={share}><Share2 className="size-[18px]" /></Button>
          </div>
        </div>

        {brand?.description && <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-2">{brand.description}</p>}

        {/* Stats */}
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-line sm:grid-cols-4">
          {[
            { label: 'Followers', value: brand?.followers },
            { label: 'Pieces', value: brand?.productsCount },
            { label: 'Likes', value: brand?.likes },
            { label: 'Sold', value: brand?.sales },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} className={cn('p-5 sm:p-7', i % 2 && 'border-l border-line', i > 1 && 'border-t border-line sm:border-t-0', i === 2 && 'sm:border-l')}>
              <div className="font-display text-[30px] font-bold leading-none tracking-[-0.03em] sm:text-[38px]">
                {s.value != null ? <AnimatedNumber value={s.value} format={(n) => compact(n)} /> : <Skeleton className="h-9 w-16" />}
              </div>
              <div className="mt-2 text-[13px] text-muted">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Products */}
        <div className="mt-14 flex items-center justify-between border-b border-line">
          <div className="flex gap-6">
            {(['grid', 'shop'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn('relative flex items-center gap-2 pb-4 text-[14px] font-semibold transition-colors', view === v ? 'text-fg' : 'text-muted hover:text-fg')}>
                {v === 'grid' ? <Grid3x3 className="size-4" /> : <Star className="size-4" />}
                {v === 'grid' ? 'Posts' : 'Shop'}
                {view === v && <motion.span layoutId="brand-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-fg" />}
              </button>
            ))}
          </div>
          {brand?.rating != null && <span className="pb-4 text-[13px] text-muted">★ {brand.rating.toFixed(1)} average rating</span>}
        </div>

        {view === 'grid' ? (
          <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="mt-1 grid grid-cols-3 gap-1 sm:mt-6 sm:gap-3">
            {products
              ? products.map((p) => (
                  <motion.div key={p.id} variants={fadeUp}>
                    <Link to={`/p/${p.id}`} className="group relative block aspect-[4/5] overflow-hidden bg-surface-2 sm:rounded-xl">
                      <Img src={p.images[0]} alt={p.name} className="size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
                      <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/45 text-[15px] font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="flex items-center gap-1.5"><Heart className="size-5 fill-white" /> {compact(p.likes)}</span>
                        <span className="flex items-center gap-1.5"><MessageCircle className="size-5 fill-white" /> {compact(p.comments)}</span>
                      </div>
                    </Link>
                  </motion.div>
                ))
              : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-none sm:rounded-xl" />)}
          </motion.div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
            {products ? products.map((p) => <ProductCard key={p.id} product={p} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        )}
        {products?.length === 0 && <p className="py-20 text-center text-muted">No pieces yet — first drop coming soon.</p>}
      </Page>
    </div>
  )
}
