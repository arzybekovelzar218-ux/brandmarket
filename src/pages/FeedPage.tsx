import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Grid2x2, Heart, Link2, Loader2, MessageCircle, Move3D, Music2, Play, Plus, Send, Share2, ShoppingBag, Smartphone, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import type { Brand, BrandMini, Comment, Product } from '../api/types'
import { Avatar } from '../components/ui/Avatar'
import { Img } from '../components/ui/Img'
import { Verified } from '../components/ui/Verified'
import { player } from '../feed/sound'
import { trackById, trackForStyle, type Track } from '../feed/tracks'
import { cn } from '../lib/cn'
import { compact, money, timeAgo } from '../lib/format'
import { ease } from '../lib/motion'
import { pageUrl } from '../lib/url'
import { useGate } from '../lib/useGate'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { toast } from '../store/toast'
import { backdropCss, DEFAULT_BACKDROP, type Design, fabricById, FINISHES, FONT_CSS } from '../studio/catalog'
import type { Motion, StudioEngine } from '../studio/engine'
import { designRef, designSound, loadDesign } from '../studio/productDesign'

const STYLES = ['Streetwear', 'Minimalism', 'Casual', 'Luxury', 'Sport', 'Vintage', 'Grunge', 'Y2K']
const SPOTLIGHT_EVERY = 6

type Source =
  | { kind: 'foryou' }
  | { kind: 'following' }
  | { kind: 'mood'; style: string }
  | { kind: 'brand'; slug: string }
  | { kind: 'sound'; track: string }

type Item = { kind: 'piece'; key: string; p: Product } | { kind: 'spotlight'; key: string; brand: Brand }

const designs = new Map<string, Promise<Design>>()
function designOf(p: Product): Promise<Design> | null {
  const ref = designRef(p.images)
  if (!ref) return null
  if (!designs.has(ref)) designs.set(ref, loadDesign(ref))
  return designs.get(ref)!
}

export const trackOf = (p: Product): Track => trackById(designSound(p.images)) ?? trackForStyle(p.brand.style, p.id)
const MOTIONS: Motion[] = ['spin', 'sway', 'float']

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255
}
const inkOn = (hex: string) => (luminance(hex) > 0.56 ? 'dark' : 'light') as 'dark' | 'light'

export default function FeedPage() {
  const me = useAuth((s) => s.me)
  const [params, setParams] = useSearchParams()
  const source = useMemo<Source>(() => {
    if (params.get('brand')) return { kind: 'brand', slug: params.get('brand')! }
    if (params.get('mood')) return { kind: 'mood', style: params.get('mood')! }
    if (params.get('sound')) return { kind: 'sound', track: params.get('sound')! }
    if (params.get('tab') === 'following') return { kind: 'following' }
    return { kind: 'foryou' }
  }, [params])
  const go = useCallback((next: Record<string, string>) => setParams(next), [setParams])

  const [items, setItems] = useState<Item[] | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [active, setActive] = useState(0)
  const [lookbook, setLookbook] = useState(false)
  const [soundOn, setSoundOn] = useState(player.enabled)
  const [needsTap, setNeedsTap] = useState(player.enabled)
  const [ready, setReady] = useState<string | null>(null)
  const [backdrop, setBackdrop] = useState(DEFAULT_BACKDROP)
  const [commentsFor, setCommentsFor] = useState<Product | null>(null)
  const [buyFor, setBuyFor] = useState<Product | null>(null)
  const [brandFor, setBrandFor] = useState<BrandMini | null>(null)
  const [followed, setFollowed] = useState<Set<number>>(new Set())
  const loading = useRef(false)
  const latest = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const hosts = useRef(new Map<string, HTMLDivElement>())
  const engine = useRef<StudioEngine | null>(null)
  const navigate = useNavigate()
  const gate = useGate()

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_CSS
      document.head.appendChild(link)
    }
    api.brands().then((b) => {
      setBrands(b)
      setFollowed(new Set(b.filter((x) => x.following).map((x) => x.id)))
    }).catch(() => undefined)
  }, [])

  /* ── Content ─────────────────────────────────────────────────── */
  const load = useCallback(async (src: Source, p: number, known: Brand[]) => {
    if (loading.current) return
    loading.current = true
    const request = latest.current
    try {
      let pieces: Product[] = []
      let more = false
      if (src.kind === 'foryou' || src.kind === 'following') {
        const r = await api.feed(src.kind, p)
        pieces = r.items
        more = r.hasMore
      } else if (src.kind === 'mood') {
        const r = await api.products({ style: src.style, page: p, pageSize: 12 })
        pieces = r.items
        more = r.hasMore
      } else if (src.kind === 'sound') {
        const r = await api.products({ pageSize: 48, page: p })
        pieces = r.items.filter((x) => trackOf(x).id === src.track)
        more = r.hasMore
      } else {
        pieces = await api.brandProducts(src.slug)
      }
      if (request !== latest.current) return // the viewer already switched to another channel
      const fresh: Item[] = pieces.map((x) => ({ kind: 'piece', key: `p${x.id}`, p: x }))
      setItems((old) => {
        const have = new Set((p === 0 ? [] : old ?? []).map((i) => i.key))
        const list: Item[] = p === 0 ? [] : [...(old ?? [])]
        for (const it of fresh) {
          if (have.has(it.key)) continue
          list.push(it)
          // A brand gets its moment on stage every few pieces, with no extra work from the brand.
          const pieceCount = list.filter((i) => i.kind === 'piece').length
          if (src.kind === 'foryou' && pieceCount % SPOTLIGHT_EVERY === 0 && known.length) {
            const b = known[(pieceCount / SPOTLIGHT_EVERY - 1) % known.length]
            list.push({ kind: 'spotlight', key: `b${b.id}-${pieceCount}`, brand: b })
          }
        }
        return list
      })
      setHasMore(more)
      setPage(p)
    } catch {
      if (request !== latest.current) return
      if (p === 0) setItems([])
      setHasMore(false)
    } finally {
      if (request === latest.current) loading.current = false
    }
  }, [])

  const sourceKey = JSON.stringify(source)
  useEffect(() => {
    setItems(null)
    setActive(0)
    setHasMore(false)
    scroller.current?.scrollTo({ top: 0 })
    loading.current = false
    const request = ++latest.current
    void (async () => {
      const known = brands.length ? brands : await api.brands().catch(() => [])
      if (request !== latest.current) return
      await load(source, 0, known)
      if (source.kind === 'brand') {
        const b = await api.brand(source.slug).catch(() => null)
        if (b && request === latest.current) setItems((l) => [{ kind: 'spotlight', key: `intro-${b.id}`, brand: b }, ...(l ?? [])])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  useEffect(() => {
    if (items && hasMore && active >= items.length - 3) void load(source, page + 1, brands)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items, hasMore, page])

  useEffect(() => {
    const root = scroller.current
    if (!root || lookbook) return
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items, lookbook])

  const current = items?.[active] ?? null

  /* ── Sound ───────────────────────────────────────────────────── */
  const currentTrack = !current || lookbook ? null : current.kind === 'piece' ? trackOf(current.p) : trackForStyle(current.brand.style, current.brand.id)
  useEffect(() => {
    player.play(currentTrack?.id ?? null)
  }, [currentTrack?.id])

  useEffect(() => {
    const unlock = () => {
      player.unlock()
      setNeedsTap(false)
    }
    const onVisibility = () => player.setHidden(document.hidden)
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('visibilitychange', onVisibility)
      player.stop()
    }
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    player.setEnabled(next)
    if (next) player.play(currentTrack?.id ?? null)
  }

  /* ── The one 3D engine, moved onto whichever slide is on screen ── */
  useEffect(() => {
    let live = true
    let reveal = 0
    void (async () => {
      if (lookbook || !current || current.kind !== 'piece') return
      const p = current.p
      const pending = designOf(p)
      if (!pending) return
      const design = await pending.catch(() => null)
      if (!live || !design) return
      if (!engine.current) {
        try {
          const { StudioEngine } = await import('../studio/engine')
          if (!live) return
          const host = hosts.current.get(current.key)
          if (!host) return
          const e = new StudioEngine(host, {
            onPick: () => undefined, onMoveLayer: () => undefined, onMoveEnd: () => undefined, onOverlay: () => undefined,
            onLoading: () => undefined, onOrbit: () => undefined, onError: () => undefined,
          }, { interactive: false })
          e.setEmbedded(true)
          e.setRunway(() => player.pulse(), () => (window.innerWidth < 1024 ? { top: 118, bottom: 270, x: 0 } : { top: 96, bottom: 24, x: 0.14 }))
          engine.current = e
        } catch {
          return // no WebGL: the rendered photo stays on stage
        }
      }
      const host = hosts.current.get(current.key)
      if (!host) return
      engine.current.attach(host)
      engine.current.apply(design, null)
      engine.current.setMotion(design.motion ?? MOTIONS[p.id % MOTIONS.length])
      // Long enough for the model and its artwork to reach the GPU, then the photo fades out.
      reveal = window.setTimeout(() => live && setReady(current.key), 650)
    })()
    setReady(null)
    return () => {
      live = false
      clearTimeout(reveal)
    }
  }, [current, lookbook])

  useEffect(() => () => {
    engine.current?.dispose()
    engine.current = null
  }, [])

  /* ── Stage colour follows the piece on screen ─────────────────── */
  useEffect(() => {
    if (!current) return
    if (current.kind === 'spotlight') return setBackdrop('#16130e')
    let live = true
    designOf(current.p)?.then((d) => live && setBackdrop(d.backdrop ?? DEFAULT_BACKDROP)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [current])
  const ink = lookbook ? 'light' : inkOn(backdrop)

  /* ── Keyboard: arrows move, M mutes ───────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const h = scroller.current?.clientHeight ?? 0
        scroller.current?.scrollBy({ top: e.key === 'ArrowDown' ? h : -h, behavior: 'smooth' })
      } else if (e.key.toLowerCase() === 'm') toggleSound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const follow = gate(async (b: { id: number; name: string }) => {
    try {
      const r = await api.follow(b.id)
      setFollowed((s) => {
        const n = new Set(s)
        if (r.active) n.add(b.id)
        else n.delete(b.id)
        return n
      })
      toast(r.active ? `Following ${b.name}` : `Unfollowed ${b.name}`)
    } catch {
      toast('Could not update', { tone: 'error' })
    }
  })

  const jumpTo = (index: number) => {
    setLookbook(false)
    window.requestAnimationFrame(() => scroller.current?.scrollTo({ top: index * (scroller.current?.clientHeight ?? 0) }))
  }

  const channel = source.kind === 'brand' ? brands.find((b) => b.slug === source.slug)?.name ?? source.slug
    : source.kind === 'mood' ? source.style
    : source.kind === 'sound' ? trackById(source.track)?.title ?? 'Sound' : null

  const barGlass = ink === 'dark' ? 'bg-black/8 text-black hover:bg-black/14' : 'bg-white/14 text-white hover:bg-white/24'

  return (
    <div className="relative h-dvh overflow-hidden text-white transition-[background] duration-700" style={{ background: lookbook ? '#0d0c0a' : backdropCss(backdrop) }}>
      {/* Top controls */}
      <div className={cn('absolute inset-x-0 top-0 z-20 space-y-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))] transition-colors duration-500 lg:px-6', ink === 'dark' ? 'text-black' : 'text-white')}>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => (channel ? go({}) : navigate(-1))} aria-label="Back" className={cn('grid size-10 shrink-0 place-items-center rounded-full backdrop-blur-md transition-colors', barGlass, !channel && 'lg:invisible')}>
            <ArrowLeft className="size-5" />
          </button>
          {channel ? (
            <p className="truncate font-display text-[17px] font-bold">{channel}</p>
          ) : (
            <div className={cn('flex gap-1 rounded-full p-1 backdrop-blur-md', ink === 'dark' ? 'bg-black/8' : 'bg-white/14')}>
              {(['foryou', 'following'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => (t === 'following' && !me ? navigate('/login', { state: { from: '/feed' } }) : go(t === 'following' ? { tab: t } : {}))}
                  className={cn('relative h-8 rounded-full px-4 text-[13px] font-semibold transition-colors', source.kind === t ? (ink === 'dark' ? 'text-white' : 'text-black') : 'opacity-75 hover:opacity-100')}
                >
                  {source.kind === t && <motion.span layoutId="feed-tab" className={cn('absolute inset-0 rounded-full', ink === 'dark' ? 'bg-black' : 'bg-white')} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className="relative">{t === 'foryou' ? 'For you' : 'Following'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex shrink-0 gap-1.5">
            <button onClick={() => setLookbook((v) => !v)} aria-label={lookbook ? 'Runway view' : 'Lookbook view'} title={lookbook ? 'Runway view' : 'Lookbook view'} className={cn('grid size-10 place-items-center rounded-full backdrop-blur-md transition-colors', barGlass)}>
              {lookbook ? <Smartphone className="size-[18px]" /> : <Grid2x2 className="size-[18px]" />}
            </button>
            <button onClick={toggleSound} aria-label={soundOn ? 'Mute' : 'Sound on'} title="Sound (M)" className={cn('grid size-10 place-items-center rounded-full backdrop-blur-md transition-colors', barGlass)}>
              {soundOn ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
            </button>
          </div>
        </div>
        {!channel && (
          <div className="no-scrollbar -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 lg:-mx-6 lg:px-6">
            {brands.slice(0, 16).map((b) => (
              <button key={b.id} onClick={() => go({ brand: b.slug })} aria-label={`${b.name} reel`} title={`${b.name} reel`} className="shrink-0 rounded-full p-[2px] ring-2 ring-current/25 transition-transform hover:scale-105">
                <Avatar src={b.logo} name={b.name} size="sm" />
              </button>
            ))}
            <span className={cn('mx-1 h-5 w-px shrink-0', ink === 'dark' ? 'bg-black/20' : 'bg-white/25')} />
            {STYLES.map((s) => (
              <button key={s} onClick={() => go({ mood: s })} className={cn('h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold backdrop-blur-md transition-colors', barGlass)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Audio stays locked until the first gesture: say so instead of being silent. */}
      <AnimatePresence>
        {soundOn && needsTap && !lookbook && items && items.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={() => { player.unlock(); setNeedsTap(false) }}
            className="absolute left-1/2 top-[108px] z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full bg-black px-4 text-[13px] font-semibold text-white shadow-lift"
          >
            <Volume2 className="size-4" /> Tap for sound
          </motion.button>
        )}
      </AnimatePresence>

      {lookbook ? (
        <Lookbook items={items} onOpen={jumpTo} />
      ) : (
        <div ref={scroller} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
          {!items && <div className="grid h-full place-items-center"><Loader2 className="size-7 animate-spin opacity-50" /></div>}
          {items?.length === 0 && (
            <div className={cn('grid h-full place-items-center px-8 text-center', ink === 'dark' ? 'text-black' : 'text-white')}>
              <div>
                <p className="font-display text-2xl font-semibold">{source.kind === 'following' ? 'Follow brands to fill this feed' : 'Nothing here yet'}</p>
                <p className="mt-2 opacity-60">New drops will show up here.</p>
                <button onClick={() => go({})} className="mt-6 h-11 rounded-full bg-black px-6 text-[14px] font-semibold text-white">Explore For you</button>
              </div>
            </div>
          )}
          {items?.map((it, i) => (
            <div key={it.key} data-index={i} className="relative h-dvh snap-start snap-always overflow-hidden">
              {it.kind === 'piece' ? (
                <Piece
                  p={it.p}
                  active={i === active}
                  near={Math.abs(i - active) <= 2}
                  ready={ready === it.key}
                  soundOn={soundOn}
                  following={followed.has(it.p.brand.id)}
                  hostRef={(el) => {
                    if (el) hosts.current.set(it.key, el)
                    else hosts.current.delete(it.key)
                  }}
                  onComments={() => setCommentsFor(it.p)}
                  onBuy={() => setBuyFor(it.p)}
                  onBrand={() => setBrandFor(it.p.brand)}
                  onFollow={() => follow(it.p.brand)}
                  onSound={(t) => go({ sound: t })}
                />
              ) : (
                <Spotlight
                  brand={it.brand}
                  near={Math.abs(i - active) <= 2}
                  following={followed.has(it.brand.id)}
                  inReel={source.kind === 'brand'}
                  onFollow={() => follow(it.brand)}
                  onPlay={() => (source.kind === 'brand' ? scroller.current?.scrollBy({ top: scroller.current.clientHeight, behavior: 'smooth' }) : go({ brand: it.brand.slug }))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <CommentsSheet product={commentsFor} onClose={() => setCommentsFor(null)} />
      <QuickBuy product={buyFor} onClose={() => setBuyFor(null)} />
      <BrandSheet brand={brandFor} following={!!brandFor && followed.has(brandFor.id)} onClose={() => setBrandFor(null)} onFollow={() => brandFor && follow(brandFor)} onReel={() => { if (brandFor) go({ brand: brandFor.slug }); setBrandFor(null) }} />
    </div>
  )
}

/* ── A piece on stage ──────────────────────────────────────────── */
function Piece({ p, active, near, ready, soundOn, following, hostRef, onComments, onBuy, onBrand, onFollow, onSound }: {
  p: Product; active: boolean; near: boolean; ready: boolean; soundOn: boolean; following: boolean
  hostRef: (el: HTMLDivElement | null) => void
  onComments: () => void; onBuy: () => void; onBrand: () => void; onFollow: () => void; onSound: (track: string) => void
}) {
  const gate = useGate()
  const [liked, setLiked] = useState(p.liked)
  const [likes, setLikes] = useState(p.likes)
  const [burst, setBurst] = useState(0)
  const [design, setDesign] = useState<Design | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const { add, busy, setOpen } = useCart()
  const lastTap = useRef(0)
  const down = useRef({ x: 0, y: 0 })
  const track = trackOf(p)

  useEffect(() => {
    if (!near || design) return
    designOf(p)?.then(setDesign).catch(() => undefined)
  }, [near, design, p])

  const backdrop = design?.backdrop ?? DEFAULT_BACKDROP
  const ink = inkOn(backdrop)
  const text = ink === 'dark' ? 'text-black' : 'text-white'
  const glass = ink === 'dark' ? 'bg-black/8 hover:bg-black/14' : 'bg-white/14 hover:bg-white/24'

  const like = gate(async (force?: boolean) => {
    if (force && liked) return setBurst((b) => b + 1)
    const next = !liked
    setLiked(next)
    setLikes((n) => n + (next ? 1 : -1))
    if (next) {
      setBurst((b) => b + 1)
      player.blip('like')
    }
    try {
      const r = await api.like(p.id)
      setLiked(r.active)
      setLikes(r.count)
    } catch {
      setLiked(!next)
      setLikes((n) => n + (next ? -1 : 1))
    }
  })

  const addNow = gate(async () => {
    if (!size) return
    if (await add({ productId: p.id, size, color: p.colors[0] ?? null, quantity: 1 })) {
      player.blip('cart')
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
    } catch { /* dismissed */ }
  }

  const facts = design ? [fabricById(design.parts.front?.fabric ?? '').label, ...new Set(design.layers.map((l) => FINISHES.find((f) => f.id === l.finish)?.label ?? ''))].filter(Boolean).slice(0, 3) : []
  const has3d = !!designRef(p.images)

  return (
    <div
      className={cn('relative size-full', text)}
      style={{ background: backdropCss(backdrop) }}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onClick={(e) => {
        if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 8 || (e.target as HTMLElement).closest('a, button, form')) return
        const now = Date.now()
        if (now - lastTap.current < 300) like(true)
        lastTap.current = now
      }}
    >
      {/* The brand's name runs huge behind the garment. */}
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-[17%] select-none overflow-hidden whitespace-nowrap font-display text-[30vh] font-bold uppercase leading-none tracking-[-0.04em] lg:text-[42vh]', ink === 'dark' ? 'text-black/[0.07]' : 'text-white/[0.09]')}>
        <span className={cn('inline-block', active && 'animate-[feed-marquee_38s_linear_infinite]')}>{`${p.brand.name} ${p.brand.name} ${p.brand.name} ${p.brand.name} `}</span>
      </div>

      {near && (
        <Img
          src={p.images[has3d ? 1 : 0] ?? p.images[0]}
          alt={p.name}
          className={cn('absolute inset-x-0 bottom-[270px] top-[118px] mx-auto h-[calc(100%-388px)] w-full object-contain transition-opacity duration-500 [mask-image:radial-gradient(70%_70%_at_50%_50%,black_62%,transparent_100%)] lg:bottom-6 lg:left-[28%] lg:top-24 lg:h-[calc(100%-120px)]', active && ready && 'opacity-0!')}
        />
      )}
      <div ref={hostRef} className={cn('absolute inset-0 transition-opacity duration-500', active && ready ? 'opacity-100' : 'opacity-0')} />

      <AnimatePresence>
        {burst > 0 && (
          <motion.div key={burst} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.2, 1], opacity: [0, 1, 0] }} transition={{ duration: 0.9, times: [0, 0.35, 1] }} className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="size-28 fill-current drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(84px+env(safe-area-inset-bottom))] pr-20 lg:p-8 lg:pr-28">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button onClick={onBrand} className="flex items-center gap-2.5 text-left">
            <Avatar src={p.brand.logo} name={p.brand.name} size="md" className="ring-2 ring-current/25" />
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">{p.brand.name} {p.brand.verified && <Verified />}</span>
          </button>
          {!following && (
            <button onClick={onFollow} className={cn('ml-1 h-7 rounded-full px-3 text-xs font-semibold backdrop-blur-md transition-colors', glass)}>Follow</button>
          )}
        </div>
        <p className="mt-3 max-w-xl font-display text-[26px] font-bold leading-[1.05] tracking-[-0.025em] lg:text-[38px]">{p.name}</p>
        {facts.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {facts.map((f) => <span key={f} className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md', glass)}>{f}</span>)}
          </div>
        )}

        {/* Buy without leaving the show. */}
        <div className="pointer-events-auto mt-4 flex flex-wrap items-center gap-2">
          <Link to={`/p/${p.id}`} className={cn('flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold backdrop-blur-md transition-colors', glass)}>
            {money(p.price)} <ArrowRight className="size-4" />
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {p.sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)} aria-pressed={size === s} className={cn('size-11 rounded-full text-[13px] font-semibold backdrop-blur-md transition-colors', size === s ? (ink === 'dark' ? 'bg-black text-white' : 'bg-white text-black') : glass)}>{s}</button>
            ))}
          </div>
          <button disabled={busy || !p.inStock} onClick={() => (window.innerWidth >= 1024 ? (size ? addNow() : toast('Pick a size first')) : gate(onBuy)())} className={cn('flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold transition-opacity hover:opacity-85 disabled:opacity-40', ink === 'dark' ? 'bg-black text-white' : 'bg-white text-black')}>
            <ShoppingBag className="size-4" /> {p.inStock ? 'Add to bag' : 'Sold out'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => onSound(track.id)} className={cn('pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-[12px] font-semibold backdrop-blur-md transition-colors', glass)}>
          <span className={cn('flex h-3.5 items-end gap-[2px]', !(active && soundOn) && 'opacity-40')}>
            {[0, 1, 2, 3].map((n) => <span key={n} style={{ animationDelay: `${n * 0.13}s`, animationDuration: `${60 / track.bpm * 2}s` }} className={cn('w-[2.5px] rounded-full bg-current', active && soundOn ? 'h-3.5 origin-bottom animate-[feed-eq_0.8s_ease-in-out_infinite]' : 'h-1')} />)}
          </span>
          <Music2 className="size-3.5 shrink-0" />
          <span className="truncate">{track.title} · {track.mood}</span>
        </button>
        {has3d && <span className="flex items-center gap-1.5 text-[12px] font-medium opacity-70"><Move3D className="size-3.5" /> Drag to turn</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute bottom-[calc(96px+env(safe-area-inset-bottom))] right-3 z-10 flex flex-col items-center gap-4 lg:bottom-8 lg:right-8">
        <Action label={compact(likes)} onClick={() => like()} aria={liked ? 'Unlike' : 'Like'} glass={glass}>
          <motion.span key={String(liked)} initial={{ scale: liked ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }}>
            <Heart className={cn('size-6', liked && 'fill-current')} strokeWidth={1.8} />
          </motion.span>
        </Action>
        <Action label={compact(p.comments)} onClick={onComments} aria="Comments" glass={glass}><MessageCircle className="size-6" strokeWidth={1.8} /></Action>
        <Action label="Share" onClick={share} aria="Share" glass={glass}><Share2 className="size-[22px]" strokeWidth={1.8} /></Action>
      </div>
    </div>
  )
}

function Action({ children, label, onClick, aria, glass }: { children: React.ReactNode; label: string; onClick: () => void; aria: string; glass: string }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={aria} className="flex flex-col items-center gap-1">
      <span className={cn('grid size-12 place-items-center rounded-full backdrop-blur-md transition-colors', glass)}>{children}</span>
      <span className="text-[11px] font-semibold tabular">{label}</span>
    </motion.button>
  )
}

/* ── A brand's moment on stage ─────────────────────────────────── */
function Spotlight({ brand, near, following, inReel, onFollow, onPlay }: { brand: Brand; near: boolean; following: boolean; inReel: boolean; onFollow: () => void; onPlay: () => void }) {
  const [pieces, setPieces] = useState<Product[]>([])
  useEffect(() => {
    if (!near || pieces.length) return
    api.brandProducts(brand.slug).then(setPieces).catch(() => undefined)
  }, [near, pieces.length, brand.slug])
  const shots = pieces.slice(0, 3)

  return (
    <div className="relative flex size-full flex-col justify-end overflow-hidden bg-[#0d0c0a] p-5 pb-[calc(96px+env(safe-area-inset-bottom))] text-white lg:p-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[14%] select-none whitespace-nowrap font-display text-[26vh] font-bold uppercase leading-none tracking-[-0.04em] text-white/[0.06] lg:text-[40vh]">{brand.name}</div>
      {shots.length > 0 && (
        <div className="absolute inset-x-0 top-[120px] flex justify-center lg:top-[118px]">
          {shots.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.7, ease }}
              style={{ rotate: `${(i - (shots.length - 1) / 2) * 7}deg`, zIndex: i === 1 ? 2 : 1 }}
              className={cn('aspect-[3/4] w-[36vw] max-w-[250px] overflow-hidden rounded-2xl shadow-pop', i > 0 && '-ml-6')}
            >
              <Img src={p.images[0]} alt={p.name} className="size-full object-cover" />
            </motion.div>
          ))}
        </div>
      )}
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold"><Sparkles className="size-3.5" /> {inReel ? 'Brand reel' : 'Brand spotlight'} · {brand.style}</p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar src={brand.logo} name={brand.name} size="lg" className="ring-2 ring-white/20" />
          <h2 className="flex items-center gap-2 font-display text-[40px] font-bold leading-none lg:text-[64px]">{brand.name}{brand.verified && <Verified />}</h2>
        </div>
        {brand.description && <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">{brand.description}</p>}
        <div className="mt-4 flex gap-5 text-[13px] text-white/70">
          <span><b className="text-white">{compact(brand.followers)}</b> followers</span>
          <span><b className="text-white">{brand.productsCount}</b> pieces</span>
          <span><b className="text-white">{compact(brand.sales)}</b> sold</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={onPlay} className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-black transition-opacity hover:opacity-85"><Play className="size-4 fill-current" /> {inReel ? 'Start the show' : 'Watch the reel'}</button>
          <button onClick={onFollow} className="flex h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-[14px] font-semibold backdrop-blur-md transition-colors hover:bg-white/20"><Users className="size-4" /> {following ? 'Following' : 'Follow'}</button>
          <Link to={`/b/${brand.slug}`} className="flex h-11 items-center rounded-full bg-white/12 px-5 text-[14px] font-semibold backdrop-blur-md transition-colors hover:bg-white/20">Brand page</Link>
        </div>
      </div>
    </div>
  )
}

/* ── Lookbook: the same feed as a wall ─────────────────────────── */
function Lookbook({ items, onOpen }: { items: Item[] | null; onOpen: (index: number) => void }) {
  return (
    <div className="no-scrollbar h-full overflow-y-auto px-3 pb-28 pt-[120px] lg:px-6">
      <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
        {items?.map((it, i) => it.kind === 'piece' && (
          <button key={it.key} onClick={() => onOpen(i)} className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl text-left">
            <Img src={it.p.images[i % 2]} alt={it.p.name} className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 text-white">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">{it.p.brand.name}</span>
              <span className="block truncate text-[14px] font-semibold">{it.p.name}</span>
              <span className="block text-[13px] font-medium tabular">{money(it.p.price)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BrandSheet({ brand, following, onClose, onFollow, onReel }: { brand: BrandMini | null; following: boolean; onClose: () => void; onFollow: () => void; onReel: () => void }) {
  const [full, setFull] = useState<Brand | null>(null)
  const [pieces, setPieces] = useState<Product[]>([])
  useEffect(() => {
    if (!brand) return
    setFull(null)
    setPieces([])
    api.brand(brand.slug).then(setFull).catch(() => undefined)
    api.brandProducts(brand.slug).then(setPieces).catch(() => undefined)
  }, [brand])

  const copyReel = async () => {
    if (!brand) return
    try {
      await navigator.clipboard.writeText(pageUrl(`/feed?brand=${brand.slug}`))
      toast('Reel link copied')
    } catch {
      toast('Could not copy the link', { tone: 'error' })
    }
  }

  return (
    <Sheet open={!!brand} onClose={onClose} title={brand?.name ?? ''}>
      {brand && (
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <Avatar src={brand.logo} name={brand.name} size="lg" />
            <div className="min-w-0 text-[13px] text-muted">
              <p className="font-semibold text-fg">{brand.style}</p>
              {full && <p>{compact(full.followers)} followers · {full.productsCount} pieces</p>}
            </div>
          </div>
          {full?.description && <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{full.description}</p>}
          <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
            {pieces.map((p) => (
              <Link key={p.id} to={`/p/${p.id}`} className="w-24 shrink-0">
                <Img src={p.images[0]} alt={p.name} className="aspect-[3/4] w-full rounded-xl object-cover" />
              </Link>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={onReel} className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-ink-fg"><Play className="size-4 fill-current" /> Watch reel</button>
            <button onClick={onFollow} className="flex h-11 items-center justify-center rounded-full border border-line-strong text-[14px] font-semibold">{following ? 'Following' : 'Follow'}</button>
            <Link to={`/b/${brand.slug}`} className="flex h-11 items-center justify-center rounded-full border border-line-strong text-[14px] font-semibold">Brand page</Link>
            <button onClick={copyReel} className="flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong text-[14px] font-semibold"><Link2 className="size-4" /> Copy reel link</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/50" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.45, ease }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[75dvh] max-w-lg flex-col rounded-t-3xl bg-surface text-fg shadow-pop"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-surface-3" />
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="text-[15px] font-semibold">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-surface-2"><X className="size-[18px]" /></button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function CommentsSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [items, setItems] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const me = useAuth((s) => s.me)
  const gate = useGate()

  useEffect(() => {
    if (!product) return
    setItems(null)
    api.comments(product.id).then(setItems).catch(() => setItems([]))
  }, [product])

  const send = gate(async () => {
    if (!product || !text.trim()) return
    try {
      const c = await api.addComment(product.id, text.trim())
      setItems((l) => [c, ...(l ?? [])])
      setText('')
    } catch {
      toast('Could not post comment', { tone: 'error' })
    }
  })

  return (
    <Sheet open={!!product} onClose={onClose} title={items ? `${items.length} comments` : 'Comments'}>
      <div className="min-h-[200px] flex-1 overflow-y-auto px-5">
        {!items && <div className="grid h-40 place-items-center"><Loader2 className="size-5 animate-spin text-muted" /></div>}
        {items?.length === 0 && <p className="py-12 text-center text-[14px] text-muted">No comments yet. Start the conversation.</p>}
        {items?.map((c) => (
          <div key={c.id} className="flex gap-3 py-3">
            <Link to={`/u/${c.user.username}`}><Avatar src={c.user.avatar} name={c.user.name} size="sm" /></Link>
            <div>
              <p className="text-[13px]"><Link to={`/u/${c.user.username}`} className="font-semibold hover:underline">{c.user.name}</Link> <span className="text-muted">· {timeAgo(c.createdAt)}</span></p>
              <p className="mt-0.5 text-[14px] text-fg-2">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t border-line px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {me && <Avatar src={me.user.avatar} name={me.user.name} size="sm" />}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-[14px] outline-none focus:ring-2 focus:ring-gold/30" />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className="grid size-11 place-items-center rounded-full bg-ink text-ink-fg disabled:opacity-30"><Send className="size-4" /></button>
      </form>
    </Sheet>
  )
}

function QuickBuy({ product: p, onClose }: { product: Product | null; onClose: () => void }) {
  const [size, setSize] = useState<string | null>(null)
  const { add, busy, setOpen } = useCart()
  useEffect(() => setSize(p?.sizes.length === 1 ? p.sizes[0] : null), [p])

  const submit = async () => {
    if (!p) return
    if (await add({ productId: p.id, size, color: p.colors[0] ?? null, quantity: 1 })) {
      onClose()
      toast('Added to your bag', { action: { label: 'View', onClick: () => setOpen(true) } })
    }
  }

  return (
    <Sheet open={!!p} onClose={onClose} title="Add to bag">
      {p && (
        <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex gap-4">
            <Img src={p.images[0]} className="h-24 w-[72px] rounded-xl object-cover" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{p.brand.name}</p>
              <p className="mt-0.5 text-[15px] font-medium">{p.name}</p>
              <p className="mt-2 text-[15px] font-semibold tabular">{money(p.price)}</p>
            </div>
          </div>
          {p.sizes.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-2">
              {p.sizes.map((s) => (
                <button key={s} onClick={() => setSize(s)} className={cn('h-11 rounded-xl border text-[14px] font-medium transition-colors', size === s ? 'border-ink bg-ink text-ink-fg' : 'border-line-strong')}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <button
            disabled={(p.sizes.length > 0 && !size) || busy || !p.inStock}
            onClick={submit}
            className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-ink-fg transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {!p.inStock ? 'Sold out' : p.sizes.length > 0 && !size ? 'Select a size' : 'Add to bag'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
