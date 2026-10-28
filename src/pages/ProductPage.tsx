import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Minus, Plus, RotateCcw, Ruler, Share2, Sparkles, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'
import type { Product } from '../api/types'
import { HeartButton, ProductCard, ProductCardSkeleton, useSave } from '../components/ProductCard'
import { Reviews } from '../components/Reviews'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Skeleton } from '../components/ui/Skeleton'
import { MiniRating } from '../components/ui/Stars'
import { Verified } from '../components/ui/Verified'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { pageUrl } from '../lib/url'
import { compact, money } from '../lib/format'
import { ease, fadeUp, stagger } from '../lib/motion'
import { useGate } from '../lib/useGate'
import { useCart } from '../store/cart'
import { toast } from '../store/toast'

export default function ProductPage() {
  const id = Number(useParams().id)
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[] | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setProduct(null); setRelated(null); setMissing(false)
    api.product(id).then(setProduct).catch(() => setMissing(true))
    api.related(id).then((r) => setRelated(r.slice(0, 5))).catch(() => setRelated([]))
  }, [id])

  if (missing)
    return (
      <Page className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="text-3xl font-bold">This piece is gone</h1>
          <p className="mt-2 text-muted">It may have sold out or been removed by the brand.</p>
          <Link to="/"><Button variant="ink" className="mt-6">Back to shop</Button></Link>
        </div>
      </Page>
    )

  return (
    <Page className="pt-6 lg:pt-8">
      <nav className="mb-6 flex items-center gap-1.5 text-[13px] text-muted">
        <Link to="/" className="hover:text-fg">Shop</Link>
        <ChevronRight className="size-3.5" />
        {product ? (
          <>
            <Link to={`/?type=${encodeURIComponent(product.type)}`} className="hover:text-fg">{product.type}</Link>
            <ChevronRight className="size-3.5" />
            <span className="truncate text-fg">{product.name}</span>
          </>
        ) : (
          <Skeleton className="h-3 w-32" />
        )}
      </nav>

      {product ? <Detail key={product.id} p={product} /> : <DetailSkeleton />}

      {product && (
        <section id="reviews" className="mt-24 scroll-mt-24 border-t border-line pt-16">
          <Reviews product={product} />
        </section>
      )}

      <section className="mt-24 border-t border-line pt-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-[26px] font-bold sm:text-3xl">You may also like</h2>
          {product && (
            <Link to={`/b/${product.brand.slug}`} className="hidden items-center gap-1 text-[14px] font-medium text-muted hover:text-fg sm:flex">
              More from {product.brand.name} <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
        <motion.div variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-5">
          {related
            ? related.map((p) => <motion.div key={p.id} variants={fadeUp}><ProductCard product={p} /></motion.div>)
            : Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </motion.div>
      </section>
    </Page>
  )
}

function Detail({ p }: { p: Product }) {
  const [img, setImg] = useState(0)
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0] : null)
  const [color, setColor] = useState<string | null>(p.colors[0] ?? null)
  const [qty, setQty] = useState(1)
  const [sizeError, setSizeError] = useState(false)
  const [saved, toggleSave] = useSave(p)
  const { add, busy, setOpen } = useCart()
  const gate = useGate()
  const navigate = useNavigate()

  const addToCart = gate(async (buyNow?: boolean) => {
    if (p.sizes.length && !size) {
      setSizeError(true)
      return
    }
    const ok = await add({ productId: p.id, size, color, quantity: qty })
    if (!ok) return
    if (buyNow) navigate('/checkout')
    else {
      toast('Added to your bag', { action: { label: 'View', onClick: () => setOpen(true) } })
    }
  })

  const share = async () => {
    const url = pageUrl(`/p/${p.id}`)
    try {
      if (navigator.share) await navigator.share({ title: p.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)] lg:gap-16 xl:gap-20">
      {/* Gallery */}
      <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4">
        {p.images.length > 1 && (
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto md:w-[76px] md:shrink-0 md:flex-col">
            {p.images.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setImg(i)}
                aria-label={`Photo ${i + 1}`}
                className={cn(
                  'aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg transition-all md:w-full',
                  img === i ? 'ring-2 ring-fg ring-offset-2 ring-offset-bg' : 'opacity-60 hover:opacity-100',
                )}
              >
                <Img src={src} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="relative aspect-[3/4] flex-1 overflow-hidden rounded-2xl bg-surface-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={img} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }} className="absolute inset-0">
              <Img src={p.images[img]} alt={p.name} className="size-full object-cover" />
            </motion.div>
          </AnimatePresence>
          {p.badges.includes('NEW') && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black backdrop-blur">New</span>}
          {p.images.length > 1 && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden">
              {p.images.map((_, i) => <span key={i} className={cn('h-1.5 rounded-full bg-white transition-all', i === img ? 'w-5' : 'w-1.5 opacity-60')} />)}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="lg:sticky lg:top-24 lg:self-start">
        <motion.div variants={fadeUp}>
          <Link to={`/b/${p.brand.slug}`} className="group inline-flex items-center gap-2.5">
            <Avatar src={p.brand.logo} name={p.brand.name} size="sm" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.12em] group-hover:underline group-hover:underline-offset-4">{p.brand.name}</span>
            {p.brand.verified && <Verified />}
          </Link>
        </motion.div>
        <motion.h1 variants={fadeUp} className="mt-5 text-[32px] font-bold leading-[1.05] sm:text-[40px]">{p.name}</motion.h1>
        <motion.div variants={fadeUp} className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          {p.rating != null && (
            <a href="#reviews" className="hover:text-fg"><MiniRating rating={p.rating} count={p.reviews} className="text-[13px]" /></a>
          )}
          <span>{compact(p.sales)} sold</span>
          <span>{compact(p.likes)} likes</span>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-7 font-display text-[30px] font-semibold tracking-[-0.02em] tabular">{money(p.price)}</motion.div>

        {p.colors.length > 0 && (
          <motion.div variants={fadeUp} className="mt-9">
            <p className="text-[13px] font-semibold">Color</p>
            <div className="mt-3 flex gap-2.5">
              {p.colors.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={cn('size-9 rounded-full ring-offset-2 ring-offset-bg transition-all', color === c ? 'ring-2 ring-fg' : 'ring-1 ring-line-strong hover:ring-fg/40')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {p.sizes.length > 0 && (
          <motion.div variants={fadeUp} className="mt-8">
            <div className="flex items-center justify-between">
              <p className={cn('text-[13px] font-semibold', sizeError && 'text-danger')}>{sizeError ? 'Please pick a size' : 'Size'}</p>
              <button className="flex items-center gap-1.5 text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline" onClick={() => toast('Fits true to size · oversized cut')}>
                <Ruler className="size-3.5" /> Size guide
              </button>
            </div>
            <motion.div animate={sizeError ? { x: [0, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.4 }} className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {p.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setSizeError(false) }}
                  className={cn(
                    'h-12 rounded-xl border text-[14px] font-medium transition-all',
                    size === s ? 'border-ink bg-ink text-ink-fg' : sizeError ? 'border-danger/50' : 'border-line-strong hover:border-fg/40',
                  )}
                >
                  {s}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="mt-8 flex gap-3">
          <div className="flex h-13 items-center rounded-full border border-line-strong">
            <button aria-label="Decrease" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="grid size-12 place-items-center text-muted hover:text-fg disabled:opacity-30"><Minus className="size-4" /></button>
            <span className="w-6 text-center text-[15px] font-semibold tabular">{qty}</span>
            <button aria-label="Increase" disabled={qty >= Math.min(20, p.stock)} onClick={() => setQty((q) => q + 1)} className="grid size-12 place-items-center text-muted hover:text-fg disabled:opacity-30"><Plus className="size-4" /></button>
          </div>
          <Button size="lg" variant="ink" className="flex-1" disabled={!p.inStock} loading={busy} onClick={() => addToCart()}>
            {p.inStock ? 'Add to bag' : 'Sold out'}
          </Button>
          <HeartButton active={saved} onToggle={toggleSave} size={20} className="size-13 shrink-0 border border-line-strong hover:border-fg/40" />
        </motion.div>
        <motion.div variants={fadeUp} className="mt-3 flex gap-3">
          <Button size="lg" variant="primary" className="flex-1" disabled={!p.inStock} onClick={() => addToCart(true)}>Buy now</Button>
          <Button size="icon-lg" variant="outline" aria-label="Share" onClick={share}><Share2 className="size-[18px]" /></Button>
        </motion.div>
        {p.inStock && p.stock <= 5 && (
          <motion.p variants={fadeUp} className="mt-4 flex items-center gap-2 text-[13px] font-medium text-gold"><Sparkles className="size-4" /> Only {p.stock} left in this drop</motion.p>
        )}

        <motion.div variants={fadeUp} className="mt-9 divide-y divide-line rounded-2xl border border-line">
          <Perk icon={Truck} title="Free delivery over 5,000 som" text="Courier across Bishkek in 1–2 days after production" />
          <Perk icon={Sparkles} title="Made to order" text="Printed and sewn at our partner factory in 5–7 days" />
          <Perk icon={RotateCcw} title="14-day returns" text="Didn't fit? Send it back, no questions asked" />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Accordion title="Description" defaultOpen>
            <p className="text-[15px] leading-relaxed text-fg-2">{p.description || 'No description yet.'}</p>
          </Accordion>
          <Accordion title="Details">
            <dl className="grid grid-cols-2 gap-y-2 text-[14px]">
              <dt className="text-muted">Type</dt><dd>{p.type}</dd>
              <dt className="text-muted">Style</dt><dd>{p.brand.style}</dd>
              <dt className="text-muted">Sizes</dt><dd>{p.sizes.join(', ') || '—'}</dd>
              <dt className="text-muted">Made in</dt><dd>Bishkek, Kyrgyzstan</dd>
            </dl>
          </Accordion>
        </motion.div>
      </motion.div>
    </div>
  )
}

const Perk = ({ icon: Icon, title, text }: { icon: typeof Truck; title: string; text: string }) => (
  <div className="flex gap-4 p-4">
    <Icon className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.7} />
    <div>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[13px] text-muted">{text}</p>
    </div>
  </div>
)

function Accordion({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-5 text-left text-[15px] font-semibold">
        {title}
        <ChevronDown className={cn('size-4 text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
            <div className="pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)] lg:gap-16 xl:gap-20">
      <div className="flex gap-4">
        <div className="hidden w-[76px] space-y-2.5 md:block">{[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}</div>
        <Skeleton className="aspect-[3/4] flex-1 rounded-2xl" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="mt-8 h-12 w-full" />
        <Skeleton className="h-13 w-full rounded-full" />
        <Skeleton className="h-13 w-full rounded-full" />
      </div>
    </div>
  )
}
