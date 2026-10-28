import { AnimatePresence, motion } from 'framer-motion'
import { Box, Check, ImagePlus, Layers, Loader2, Palette, Plus, RotateCw, Send, Sparkles, Type, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import type { BrandMini } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Img } from '../components/ui/Img'
import { Input } from '../components/ui/Input'
import { Verified } from '../components/ui/Verified'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { money } from '../lib/format'
import { ease } from '../lib/motion'
import { useAuth } from '../store/auth'
import { toast } from '../store/toast'

const STYLES = ['Streetwear', 'Minimalism', 'Casual', 'Luxury', 'Sport', 'Vintage', 'Grunge', 'Y2K']
const TYPES = ['Hoodie', 'T-Shirt', 'Sweatshirt', 'Longsleeve', 'Pants', 'Shorts']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SWATCHES = ['#16130e', '#f5f3ee', '#8a8a86', '#6b4f3a', '#2f3d2c', '#1f2a44', '#b8963e', '#a33b32']

export default function CreatePage() {
  const brands = useAuth((s) => s.me?.user.brands ?? [])
  return (
    <Page>
      <PageHeader
        eyebrow="Create"
        title={brands.length ? 'New drop' : 'Launch your brand'}
        sub={brands.length ? 'Add a piece — it goes live in the shop and feed, production starts with the first order.' : 'Name it, give it a face. We manufacture, ship and sell — you design.'}
      />
      {brands.length ? <DropForm brands={brands} /> : <BrandForm />}
      <Studio3D />
    </Page>
  )
}

/** File picker that uploads immediately and returns the public URL. */
function Upload({ value, onChange, label, className, round }: { value?: string; onChange: (url: string) => void; label: string; className?: string; round?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      onChange(await api.upload(f))
    } catch (e) {
      toast(errorMessage(e, 'Upload failed'), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={cn(
        'group relative grid place-items-center overflow-hidden border border-dashed border-line-strong bg-surface-2/60 text-muted transition-colors hover:border-gold hover:text-gold',
        round ? 'rounded-full' : 'rounded-2xl',
        className,
      )}
    >
      {value ? <Img src={value} className="absolute inset-0 size-full object-cover" /> : null}
      <span className={cn('relative flex flex-col items-center gap-1.5 text-[12px] font-medium', value && 'rounded-full bg-black/55 px-3 py-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100')}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        {!value && label}
        {value && 'Change'}
      </span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </button>
  )
}

function BrandForm() {
  const [f, setF] = useState({ name: '', description: '', style: 'Streetwear', logo: '', banner: '' })
  const [busy, setBusy] = useState(false)
  const refresh = useAuth((s) => s.refresh)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const b = await api.createBrand({ ...f, logo: f.logo || undefined, banner: f.banner || undefined })
      await refresh()
      toast(`${b.name} is live`)
      navigate(`/b/${b.slug}`)
    } catch (err) {
      toast(errorMessage(err, 'Could not create brand'), { tone: 'error' })
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">
      <form onSubmit={submit} className="space-y-8">
        <Input id="bn" label="Brand name" placeholder="e.g. SAKURA STUDIO" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <label className="block space-y-2">
          <span className="text-[13px] font-medium text-fg-2">What's it about?</span>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1000} rows={4} placeholder="Heavyweight basics inspired by the mountains of Naryn…" className="w-full resize-none rounded-xl border border-line-strong bg-surface p-4 text-[15px] outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15" />
        </label>
        <div>
          <p className="mb-3 text-[13px] font-medium text-fg-2">Style</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button type="button" key={s} onClick={() => setF({ ...f, style: s })} className={cn('h-10 rounded-full border px-4 text-[13px] font-medium transition-colors', f.style === s ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong text-fg-2 hover:border-fg/30')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[112px_1fr] gap-4">
          <div>
            <p className="mb-3 text-[13px] font-medium text-fg-2">Logo</p>
            <Upload value={f.logo} onChange={(logo) => setF({ ...f, logo })} label="Logo" round className="size-28" />
          </div>
          <div>
            <p className="mb-3 text-[13px] font-medium text-fg-2">Banner</p>
            <Upload value={f.banner} onChange={(banner) => setF({ ...f, banner })} label="Banner image" className="h-28 w-full" />
          </div>
        </div>
        <Button type="submit" variant="ink" size="lg" loading={busy} disabled={!f.name.trim()} className="w-full sm:w-auto">
          <Sparkles className="size-4" /> Launch brand
        </Button>
      </form>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Live preview</p>
        <Card className="overflow-hidden">
          <div className="relative h-36 bg-gradient-to-br from-gold/40 via-surface-2 to-surface-3">
            {f.banner && <Img src={f.banner} className="absolute inset-0 size-full object-cover" />}
          </div>
          <div className="px-6 pb-6">
            <div className="-mt-10">
              <Avatar src={f.logo || null} name={f.name || 'Your Brand'} size="xl" className="size-20 ring-[3px] ring-gold ring-offset-4 ring-offset-surface" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <h3 className="truncate text-2xl font-bold">{f.name || 'Your brand'}</h3>
              <Verified className="size-5 opacity-30" />
            </div>
            <p className="mt-1 text-[13px] text-muted">@{(f.name || 'your-brand').toLowerCase().trim().replace(/\s+/g, '-')} · {f.style}</p>
            <p className="mt-4 line-clamp-3 text-[14px] leading-relaxed text-fg-2">{f.description || 'Your story goes here. Tell shoppers what makes your pieces different.'}</p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {['Followers', 'Pieces', 'Sold'].map((l) => (
                <div key={l} className="rounded-xl bg-surface-2 py-3">
                  <p className="font-display text-lg font-bold">0</p>
                  <p className="text-[11px] text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">Verification badge is granted by the BrandMarket team after your first sales.</p>
      </div>
    </div>
  )
}

function DropForm({ brands }: { brands: BrandMini[] }) {
  const [brandId, setBrandId] = useState(brands[0].id)
  const [f, setF] = useState({ name: '', description: '', price: '', type: 'Hoodie', sizes: ['S', 'M', 'L', 'XL'], colors: ['#16130e'], stock: '20', images: [] as string[] })
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const brand = brands.find((b) => b.id === brandId)!
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.images.length) return toast('Add at least one photo', { tone: 'error' })
    setBusy(true)
    try {
      const p = await api.addProduct(brandId, { ...f, price: Number(f.price), stock: Number(f.stock) })
      toast('Your drop is live')
      navigate(`/p/${p.id}`)
    } catch (err) {
      toast(errorMessage(err, 'Could not publish'), { tone: 'error' })
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <form onSubmit={submit} className="space-y-8">
        {brands.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <button type="button" key={b.id} onClick={() => setBrandId(b.id)} className={cn('flex h-10 items-center gap-2 rounded-full border pl-1 pr-4 text-[13px] font-medium', brandId === b.id ? 'border-gold bg-gold-soft' : 'border-line-strong')}>
                <Avatar src={b.logo} name={b.name} size="sm" />{b.name}
              </button>
            ))}
          </div>
        )}
        <div>
          <p className="mb-3 text-[13px] font-medium text-fg-2">Photos <span className="text-muted">(first one is the cover)</span></p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {f.images.map((src, i) => (
              <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
                <Img src={src} className="size-full object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setF({ ...f, images: f.images.filter((_, j) => j !== i) })} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"><X className="size-3.5" /></button>
              </div>
            ))}
            {f.images.length < 5 && <Upload onChange={(url) => setF((s) => ({ ...s, images: [...s.images, url] }))} label="Add photo" className="aspect-[3/4]" />}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Input id="pn" label="Name" placeholder={`${brand.name} Heavy Hoodie`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} />
          <Input id="pp" label="Price, som" type="number" min={1} placeholder="2900" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required />
        </div>
        <div>
          <p className="mb-3 text-[13px] font-medium text-fg-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button type="button" key={t} onClick={() => setF({ ...f, type: t })} className={cn('h-10 rounded-full border px-4 text-[13px] font-medium', f.type === t ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong text-fg-2')}>{t}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-[13px] font-medium text-fg-2">Sizes</p>
            <div className="grid grid-cols-6 gap-1.5">
              {SIZES.map((s) => (
                <button type="button" key={s} onClick={() => setF({ ...f, sizes: toggle(f.sizes, s) })} className={cn('h-10 rounded-lg border text-[12px] font-semibold', f.sizes.includes(s) ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong')}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-medium text-fg-2">Colors</p>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button type="button" key={c} aria-label={c} onClick={() => setF({ ...f, colors: toggle(f.colors, c) })} className={cn('grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-bg', f.colors.includes(c) ? 'ring-2 ring-fg' : 'ring-1 ring-line-strong')} style={{ background: c }}>
                  {f.colors.includes(c) && <Check className={cn('size-4', c === '#f5f3ee' ? 'text-black' : 'text-white')} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="block space-y-2">
          <span className="text-[13px] font-medium text-fg-2">Description</span>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} maxLength={2000} placeholder="420 gsm cotton fleece, boxy fit, puff print on the back…" className="w-full resize-none rounded-xl border border-line-strong bg-surface p-4 text-[15px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-36"><Input id="ps" label="Stock" type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} required /></div>
          <Button type="submit" variant="ink" size="lg" loading={busy} disabled={!f.name || !f.price || !f.sizes.length}><Send className="size-4" /> Publish drop</Button>
        </div>
      </form>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Preview</p>
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
          {f.images[0] ? <Img src={f.images[0]} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-[13px] text-faint">Cover photo</div>}
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-black">New</span>
        </div>
        <div className="mt-3.5 space-y-1 px-0.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]">{brand.name}{brand.verified && <Verified className="size-3.5" />}</p>
          <p className="truncate text-[13px] text-muted">{f.name || 'Product name'}</p>
          <p className="text-[13px] font-semibold tabular">{f.price ? money(Number(f.price)) : '— som'}</p>
        </div>
        <Link to="/dashboard" className="mt-6 inline-block text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">Open brand studio →</Link>
      </div>
    </div>
  )
}

/** 3D configurator teaser — honest "in development" state until a production-grade garment model is ready. */
function Studio3D() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2600)
    return () => clearInterval(t)
  }, [])
  const PREVIEW = [1, 6, 4, 5]
  const color = SWATCHES[PREVIEW[tick % PREVIEW.length]]

  return (
    <section className="mt-24">
      <div className="relative overflow-hidden rounded-3xl bg-[#0d0c0a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(700px_400px_at_75%_40%,rgba(201,165,77,0.18),transparent_70%)]" />
        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:p-14">
          <div className="flex flex-col">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-gold" /></span>
              In development
            </span>
            <h2 className="mt-6 text-[34px] font-bold leading-[1.05] sm:text-[44px]">3D Studio</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65">
              Design your hoodie on a photoreal 3D model: rotate it, pick fabric and color, place prints and embroidery — and send the exact spec straight to the factory.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                [RotateCw, '360° photoreal preview'],
                [Palette, 'Fabric & color library'],
                [Type, 'Prints, text & embroidery'],
                [Layers, 'Tech pack for the factory'],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Box
                return (
                  <li key={t as string} className="flex items-center gap-3 text-[14px] text-white/80">
                    <span className="grid size-9 place-items-center rounded-xl bg-white/8 ring-1 ring-white/10"><I className="size-4 text-gold" /></span>
                    {t as string}
                  </li>
                )
              })}
            </ul>
            <div className="mt-auto pt-10">
              <Button variant="primary" onClick={() => toast("You're on the list — we'll tell you when 3D Studio opens")}><Plus className="size-4" /> Get early access</Button>
            </div>
          </div>

          {/* Preview window — a placeholder UI, clearly not the real 3D editor */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-white/15" />)}
              <span className="ml-3 text-[12px] text-white/40">studio.brandmarket — hoodie_v1</span>
            </div>
            <div className="relative grid aspect-[4/3] place-items-center">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
              <AnimatePresence mode="wait">
                <motion.svg key={color} viewBox="0 0 200 200" className="relative w-[46%] drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]" initial={{ opacity: 0, rotateY: -40 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 40 }} transition={{ duration: 0.8, ease }}>
                  <path d="M70 30c6 12 18 18 30 18s24-6 30-18l34 16 22 54-24 10-8-20v86H46V90l-8 20-24-10 22-54z" fill={color} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  <path d="M70 30c4 22 16 34 30 34s26-12 30-34" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
                  <path d="M76 140h48v22H76z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" rx="4" />
                  <text x="100" y="112" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="14" fill={color === SWATCHES[1] ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)'}>YOUR LOGO</text>
                </motion.svg>
              </AnimatePresence>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/50 p-1.5 ring-1 ring-white/10 backdrop-blur">
                {PREVIEW.map((i) => <span key={i} className={cn('size-6 rounded-full ring-2', SWATCHES[i] === color ? 'ring-gold' : 'ring-transparent')} style={{ background: SWATCHES[i] }} />)}
              </div>
              <div className="absolute inset-0 grid place-items-center bg-black/0">
                <span className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/70 ring-1 ring-white/10">Concept preview</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
