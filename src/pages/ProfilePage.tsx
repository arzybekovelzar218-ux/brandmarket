import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Camera, ChevronRight, Loader2, LogOut, Moon, Pencil, Repeat2, Store, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import type { Product, UserDto } from '../api/types'
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Verified } from '../components/ui/Verified'
import { Page } from '../layout/AppShell'
import { navFor } from '../layout/nav'
import { cn } from '../lib/cn'
import { ease, fadeUp, stagger } from '../lib/motion'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { toast } from '../store/toast'
import { Empty } from './FavoritesPage'

type Tab = 'reposts' | 'saved' | 'brands'

export default function ProfilePage() {
  const { username = '' } = useParams()
  const me = useAuth((s) => s.me)
  const isMe = me?.user.username.toLowerCase() === username.toLowerCase()
  const [user, setUser] = useState<UserDto | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState<Tab>('reposts')
  const [reposts, setReposts] = useState<Product[] | null>(null)
  const [saved, setSaved] = useState<Product[] | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setUser(null); setMissing(false); setReposts(null); setSaved(null); setTab('reposts')
    api.user(username).then(setUser).catch(() => setMissing(true))
    api.userReposts(username).then(setReposts).catch(() => setReposts([]))
  }, [username])

  // own profile reflects edits made through /me
  useEffect(() => {
    if (isMe && me) setUser((u) => (u ? { ...u, ...me.user } : u))
  }, [isMe, me])

  useEffect(() => {
    if (tab === 'saved' && isMe && !saved) api.wishlist().then(setSaved).catch(() => setSaved([]))
  }, [tab, isMe, saved])

  if (missing)
    return (
      <Page className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="text-3xl font-bold">User not found</h1>
          <Link to="/"><Button variant="ink" className="mt-6">Back to shop</Button></Link>
        </div>
      </Page>
    )

  const tabs: { id: Tab; label: string; icon: typeof Repeat2 }[] = [
    { id: 'reposts', label: 'Reposts', icon: Repeat2 },
    ...(isMe ? [{ id: 'saved' as const, label: 'Saved', icon: Bookmark }] : []),
    ...(user?.brands.length ? [{ id: 'brands' as const, label: 'Brands', icon: Store }] : []),
  ]
  const list = tab === 'reposts' ? reposts : saved

  return (
    <div>
      {/* Cover */}
      <div className="relative h-40 overflow-hidden sm:h-52">
        <div className="absolute inset-0 bg-[radial-gradient(600px_260px_at_20%_0%,rgba(201,165,77,0.45),transparent_70%),radial-gradient(500px_260px_at_90%_30%,rgba(143,160,128,0.35),transparent_70%)] bg-surface-2" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
      </div>

      <Page>
        <div className="relative -mt-20 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {user ? (
              <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative w-fit">
                <Avatar src={user.avatar} name={user.name} size="xl" className="size-28 ring-[3px] ring-gold ring-offset-4 ring-offset-bg sm:size-32" />
                {isMe && (
                  <button onClick={() => setEditing(true)} aria-label="Change photo" className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full bg-ink text-ink-fg shadow-pop transition-transform hover:scale-105">
                    <Camera className="size-4" />
                  </button>
                )}
              </motion.div>
            ) : (
              <Skeleton className="size-28 rounded-full sm:size-32" />
            )}
            <div className="pb-1">
              {user ? (
                <>
                  <h1 className="text-[32px] font-bold leading-none sm:text-[40px]">{user.name}</h1>
                  <p className="mt-2.5 text-[14px] text-muted">
                    @{user.username}
                    {user.role !== 'USER' && <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">{user.role === 'ADMIN' ? 'Admin' : 'Factory'}</span>}
                  </p>
                </>
              ) : (
                <div className="space-y-3"><Skeleton className="h-9 w-52" /><Skeleton className="h-4 w-28" /></div>
              )}
            </div>
          </div>
          {isMe && user && (
            <Button variant="outline" onClick={() => setEditing(true)} className="w-fit"><Pencil className="size-4" /> Edit profile</Button>
          )}
        </div>

        {user?.bio && <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-fg-2">{user.bio}</p>}
        {isMe && user && !user.bio && (
          <button onClick={() => setEditing(true)} className="mt-6 text-[14px] text-muted underline-offset-4 hover:text-fg hover:underline">+ Add a short bio</button>
        )}
        {user && user.interests.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {user.interests.map((s) => <span key={s} className="rounded-full border border-line-strong px-3 py-1 text-[12px] font-medium text-fg-2">{s}</span>)}
          </div>
        )}

        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="mt-8 grid max-w-md grid-cols-3 overflow-hidden rounded-2xl border border-line">
          {[
            { label: 'Following', value: user?.following },
            { label: 'Reposts', value: user?.reposts },
            { label: 'Brands', value: user?.brands.length },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} className={cn('p-4 sm:p-5', i > 0 && 'border-l border-line')}>
              <div className="font-display text-[26px] font-bold leading-none tracking-[-0.03em]">
                {s.value != null ? <AnimatedNumber value={s.value} /> : <Skeleton className="h-7 w-10" />}
              </div>
              <div className="mt-1.5 text-[12px] text-muted">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {isMe && me && <QuickLinks />}

        {/* Tabs */}
        <div className="mt-12 flex gap-6 border-b border-line">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={cn('relative flex items-center gap-2 pb-4 text-[14px] font-semibold transition-colors', tab === id ? 'text-fg' : 'text-muted hover:text-fg')}>
              <Icon className="size-4" /> {label}
              {tab === id && <motion.span layoutId="profile-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-fg" />}
            </button>
          ))}
        </div>

        <div className="pt-8">
          {tab === 'brands' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {user?.brands.map((b) => (
                <Link key={b.id} to={`/b/${b.slug}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
                  <Avatar src={b.logo} name={b.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">{b.name}{b.verified && <Verified />}</p>
                    <p className="text-[13px] text-muted">{b.style}</p>
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              ))}
            </div>
          ) : list?.length === 0 ? (
            <Empty
              icon={tab === 'reposts' ? Repeat2 : Bookmark}
              title={tab === 'reposts' ? 'No reposts yet' : 'Nothing saved yet'}
              text={tab === 'reposts' ? (isMe ? 'Repost pieces from the feed to show them here.' : 'Reposted pieces will appear here.') : 'Tap the heart on any piece to keep it here.'}
              cta={isMe ? <Link to={tab === 'reposts' ? '/feed' : '/'}><Button variant="ink">{tab === 'reposts' ? 'Open the feed' : 'Browse the shop'}</Button></Link> : undefined}
            />
          ) : (
            <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4 min-[1400px]:grid-cols-5">
              {list ? list.map((p) => <motion.div key={p.id} variants={fadeUp}><ProductCard product={p} /></motion.div>) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </motion.div>
          )}
        </div>
      </Page>

      <EditProfile open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

/** Own-profile shortcuts: what the old "Account" menu held. */
function QuickLinks() {
  const me = useAuth((s) => s.me)!
  const logout = useAuth((s) => s.logout)
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { main, work } = navFor(me)
  const links = [...main.filter((i) => i.to !== '/' && i.to !== '/feed'), ...work]
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {links.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-medium transition-colors hover:border-fg/30">
          <Icon className="size-4 text-muted" /> {label}
        </Link>
      ))}
      <button onClick={toggle} className="flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-medium transition-colors hover:border-fg/30 lg:hidden">
        {theme === 'dark' ? <Sun className="size-4 text-muted" /> : <Moon className="size-4 text-muted" />} {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
      <button onClick={() => { logout(); navigate('/') }} className="flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-medium text-danger transition-colors hover:border-danger/40">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  )
}

function EditProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAuth((s) => s.me)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && me) { setName(me.user.name); setBio(me.user.bio ?? ''); setAvatar(me.user.avatar) }
  }, [open, me])

  const upload = async (f?: File) => {
    if (!f) return
    setUploading(true)
    try { setAvatar(await api.upload(f)) } catch (e) { toast(errorMessage(e, 'Upload failed'), { tone: 'error' }) } finally { setUploading(false) }
  }
  const save = async () => {
    setBusy(true)
    try {
      const updated = await api.updateMe({ name: name.trim(), bio: bio.trim(), avatar: avatar ?? undefined })
      useAuth.setState({ me: updated })
      toast('Profile updated')
      onClose()
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && me && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
          <motion.div
            role="dialog"
            aria-label="Edit profile"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease }}
            className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-3xl bg-surface p-6 shadow-pop sm:inset-x-4 sm:bottom-auto sm:top-[12vh]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit profile</h2>
              <Button variant="soft" size="icon-sm" aria-label="Close" onClick={onClose}><X className="size-[18px]" /></Button>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <button onClick={() => file.current?.click()} className="group relative rounded-full" aria-label="Upload photo">
                <Avatar src={avatar} name={name || me.user.name} size="lg" className="size-20" />
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                </span>
              </button>
              <div>
                <button onClick={() => file.current?.click()} className="text-[14px] font-semibold text-gold hover:underline">Upload new photo</button>
                <p className="text-[12px] text-muted">JPG or PNG, up to 15 MB</p>
              </div>
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <div className="mt-6 space-y-4">
              <Input id="pf-name" label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-fg-2">Bio</span>
                <textarea value={bio} maxLength={500} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="Collector of local brands, Bishkek" className="w-full resize-none rounded-xl border border-line-strong bg-bg p-4 text-[15px] outline-none focus:border-gold focus:ring-4 focus:ring-gold/15" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="ink" className="flex-[2]" loading={busy} disabled={!name.trim() || uploading} onClick={save}>Save</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
