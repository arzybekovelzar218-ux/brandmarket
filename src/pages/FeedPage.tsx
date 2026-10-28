import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Heart, Loader2, MessageCircle, Plus, Send, Share2, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import type { Comment, Product } from '../api/types'
import { Avatar } from '../components/ui/Avatar'
import { Img } from '../components/ui/Img'
import { Verified } from '../components/ui/Verified'
import { cn } from '../lib/cn'
import { compact, money, timeAgo } from '../lib/format'
import { ease } from '../lib/motion'
import { media, pageUrl } from '../lib/url'
import { useGate } from '../lib/useGate'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { toast } from '../store/toast'

type Tab = 'foryou' | 'following'

/** Videos that failed once (e.g. not uploaded to the server) are not requested again. */
const brokenVideos = new Set<string>()

export default function FeedPage() {
  const me = useAuth((s) => s.me)
  const [tab, setTab] = useState<Tab>('foryou')
  const [items, setItems] = useState<Product[] | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [active, setActive] = useState(0)
  const [muted, setMuted] = useState(true)
  const [commentsFor, setCommentsFor] = useState<Product | null>(null)
  const [buyFor, setBuyFor] = useState<Product | null>(null)
  const loading = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const load = useCallback(async (t: Tab, p: number) => {
    if (loading.current) return
    loading.current = true
    try {
      const r = await api.feed(t, p)
      setItems((l) => (p === 0 ? r.items : [...(l ?? []), ...r.items.filter((x) => !l?.some((y) => y.id === x.id))]))
      setHasMore(r.hasMore)
      setPage(p)
    } catch {
      if (p === 0) setItems([])
      setHasMore(false)
    } finally {
      loading.current = false
    }
  }, [])

  useEffect(() => {
    setItems(null); setActive(0)
    scroller.current?.scrollTo({ top: 0 })
    load(tab, 0)
  }, [tab, load])

  useEffect(() => {
    if (items && hasMore && active >= items.length - 3) load(tab, page + 1)
  }, [active, items, hasMore, tab, page, load])

  // track which reel is on screen
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items])

  return (
    <div className="relative h-dvh overflow-hidden bg-black text-white">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-10 pt-[max(16px,env(safe-area-inset-top))] lg:px-8">
        <button onClick={() => navigate(-1)} aria-label="Back" className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20 lg:invisible">
          <ArrowLeft className="size-5" />
        </button>
        <div className="pointer-events-auto flex gap-1 rounded-full bg-white/10 p-1 backdrop-blur-md">
          {(['foryou', 'following'] as const).map((t) => (
            <button
              key={t}
              onClick={() => (t === 'following' && !me ? navigate('/login', { state: { from: '/feed' } }) : setTab(t))}
              className={cn('relative h-8 rounded-full px-4 text-[13px] font-semibold transition-colors', tab === t ? 'text-black' : 'text-white/75 hover:text-white')}
            >
              {tab === t && <motion.span layoutId="feed-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{t === 'foryou' ? 'For you' : 'Following'}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
          {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
        </button>
      </div>

      <div ref={scroller} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {!items && (
          <div className="grid h-full place-items-center"><Loader2 className="size-7 animate-spin text-white/50" /></div>
        )}
        {items?.length === 0 && (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="font-display text-2xl font-semibold">{tab === 'following' ? 'Follow brands to fill this feed' : 'Nothing here yet'}</p>
              <p className="mt-2 text-white/60">New drops from brands you follow will show up here.</p>
              <button onClick={() => setTab('foryou')} className="mt-6 h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-black">Explore For you</button>
            </div>
          </div>
        )}
        {items?.map((p, i) => (
          <div key={p.id} data-index={i} className="relative flex h-dvh snap-start snap-always items-center justify-center lg:py-6">
            <Reel
              p={p}
              active={i === active}
              near={Math.abs(i - active) <= 1}
              muted={muted}
              onComments={() => setCommentsFor(p)}
              onBuy={() => setBuyFor(p)}
            />
          </div>
        ))}
      </div>

      <CommentsSheet product={commentsFor} onClose={() => setCommentsFor(null)} />
      <QuickBuy product={buyFor} onClose={() => setBuyFor(null)} />
    </div>
  )
}

function Reel({ p, active, near, muted, onComments, onBuy }: { p: Product; active: boolean; near: boolean; muted: boolean; onComments: () => void; onBuy: () => void }) {
  const gate = useGate()
  const [liked, setLiked] = useState(p.liked)
  const [likes, setLikes] = useState(p.likes)
  const [following, setFollowing] = useState(false)
  const [burst, setBurst] = useState(0)
  const [videoFailed, setVideoFailed] = useState(() => !!p.videoUrl && brokenVideos.has(p.videoUrl))
  const video = useRef<HTMLVideoElement>(null)
  const lastTap = useRef(0)

  useEffect(() => {
    const v = video.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])

  const like = gate(async (force?: boolean) => {
    if (force && liked) return setBurst((b) => b + 1)
    const next = !liked
    setLiked(next); setLikes((n) => n + (next ? 1 : -1))
    if (next) setBurst((b) => b + 1)
    try {
      const r = await api.like(p.id)
      setLiked(r.active); setLikes(r.count)
    } catch {
      setLiked(!next); setLikes((n) => n + (next ? -1 : 1))
    }
  })

  const follow = gate(async () => {
    setFollowing(true)
    try {
      const r = await api.follow(p.brand.id)
      setFollowing(r.active)
      toast(r.active ? `Following ${p.brand.name}` : `Unfollowed ${p.brand.name}`)
    } catch {
      setFollowing(false)
    }
  })

  const share = async () => {
    const url = pageUrl(`/p/${p.id}`)
    try {
      if (navigator.share) await navigator.share({ title: p.name, url })
      else { await navigator.clipboard.writeText(url); toast('Link copied') }
    } catch { /* dismissed */ }
  }

  const onTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) like(true)
    lastTap.current = now
  }

  const showVideo = p.videoUrl && !videoFailed && near

  return (
    <div className="relative flex h-full w-full items-end gap-5 lg:w-auto">
      <div onClick={onTap} className="relative h-full w-full overflow-hidden bg-neutral-900 lg:aspect-[9/16] lg:w-auto lg:rounded-3xl">
        {showVideo ? (
          <video
            ref={video}
            src={media(p.videoUrl)}
            poster={media(p.images[0])}
            muted={muted}
            loop
            playsInline
            autoPlay={active}
            onError={() => { brokenVideos.add(p.videoUrl!); setVideoFailed(true) }}
            className="size-full object-cover"
          />
        ) : (
          <motion.div
            className="size-full"
            animate={active ? { scale: [1, 1.12], x: ['0%', '-3%'] } : { scale: 1, x: '0%' }}
            transition={{ duration: 14, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
          >
            <Img src={p.images[0]} alt={p.name} className="size-full object-cover" />
          </motion.div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

        <AnimatePresence>
          {burst > 0 && (
            <motion.div key={burst} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.2, 1], opacity: [0, 1, 0] }} transition={{ duration: 0.9, times: [0, 0.35, 1] }} className="pointer-events-none absolute inset-0 grid place-items-center">
              <Heart className="size-28 fill-gold text-gold drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info */}
        <div className="absolute inset-x-0 bottom-0 p-5 pb-24 pr-20 lg:pb-6 lg:pr-6">
          <div className="flex items-center gap-2.5">
            <Link to={`/b/${p.brand.slug}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5">
              <Avatar src={p.brand.logo} name={p.brand.name} size="md" className="ring-2 ring-white/30" />
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                {p.brand.name} {p.brand.verified && <Verified className="text-black" />}
              </span>
            </Link>
            {!following && (
              <button onClick={(e) => { e.stopPropagation(); follow() }} className="ml-1 h-7 rounded-full border border-white/40 px-3 text-xs font-semibold backdrop-blur transition-colors hover:bg-white hover:text-black">
                Follow
              </button>
            )}
          </div>
          <p className="mt-3 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">{p.name}</p>
          {p.description && <p className="mt-1.5 line-clamp-2 max-w-sm text-[13px] leading-snug text-white/70">{p.description}</p>}
          <Link
            to={`/p/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-4 inline-flex h-11 items-center gap-3 rounded-full bg-white/12 pl-2 pr-5 backdrop-blur-xl ring-1 ring-white/15 transition-colors hover:bg-white/20"
          >
            <Img src={p.images[1] ?? p.images[0]} className="size-8 rounded-full object-cover" />
            <span className="text-[13px] font-semibold">{money(p.price)}</span>
            <span className="h-4 w-px bg-white/25" />
            <span className="text-[13px] text-white/80">View item</span>
          </Link>
        </div>
      </div>

      {/* Actions */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5 lg:static lg:bottom-auto lg:mb-6 lg:gap-6">
        <Action label={compact(likes)} onClick={() => like()} aria={liked ? 'Unlike' : 'Like'}>
          <motion.span key={String(liked)} initial={{ scale: liked ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }}>
            <Heart className={cn('size-7', liked && 'fill-gold text-gold')} strokeWidth={1.8} />
          </motion.span>
        </Action>
        <Action label={compact(p.comments)} onClick={onComments} aria="Comments"><MessageCircle className="size-7" strokeWidth={1.8} /></Action>
        <Action label="Share" onClick={share} aria="Share"><Share2 className="size-[26px]" strokeWidth={1.8} /></Action>
        <Action label="Buy" onClick={gate(onBuy)} aria="Add to bag" gold><ShoppingBag className="size-6" strokeWidth={2} /></Action>
      </div>
    </div>
  )
}

function Action({ children, label, onClick, aria, gold }: { children: React.ReactNode; label: string; onClick: () => void; aria: string; gold?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={aria} className="flex flex-col items-center gap-1.5">
      <span className={cn('grid size-12 place-items-center rounded-full backdrop-blur-md transition-colors lg:size-[52px]', gold ? 'bg-gold text-black hover:bg-gold-hi' : 'bg-white/10 hover:bg-white/20 lg:bg-white/8')}>
        {children}
      </span>
      <span className="text-xs font-semibold tabular drop-shadow">{label}</span>
    </motion.button>
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
