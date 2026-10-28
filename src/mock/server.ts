/* In-browser mock of the BrandMarket API, used when the site is deployed without a backend (VITE_MOCK=true).
   Seeded from a snapshot of the real demo backend; every action works and is kept in localStorage. */
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type * as T from '../api/types'
import { STAGES } from '../api/types'
import seed from './data.json'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any
const KEY = 'bm-mock-db-v2'
const clone = <V,>(v: V): V => JSON.parse(JSON.stringify(v))
const now = () => new Date().toISOString().slice(0, 23)

interface PerUser {
  me: T.Me; notifications: T.AppNotification[]; liked: number[]; saved: number[]; reposted: number[]
  following: number[]; cart: T.Cart; orders: T.Order[]; votes: Record<string, number | null>
}
interface DB {
  accounts: { email: string; password: string; username: string }[]
  products: T.Product[]; facets: T.Facets; home: T.Home; brands: T.Brand[]; styles: string[]
  reviews: Record<string, T.ReviewSummary>; comments: Record<string, T.Comment[]>; related: Record<string, number[]>
  feedOrder: number[]; events: T.Poll[]; dashboards: Record<string, T.Dashboard>; adminStats: T.AdminStats
  board: T.Order[]; workers: T.UserMini[]; users: Record<string, T.UserDto>; reposts: Record<string, number[]>
  perUser: Record<string, PerUser>; seq: number
}

let db: DB = load()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fresh copy */ }
  return fresh()
}
/** Seed copy; video files live only on the real backend, so the demo uses animated photos. */
function fresh(): DB {
  const d = { ...(clone(seed) as Any), seq: 100000 } as DB
  for (const p of d.products) p.videoUrl = null
  for (const p of [...d.home.trending, ...d.home.fresh]) p.videoUrl = null
  return d
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota / private mode: keep in memory */ }
}
/** Wipe demo changes (e.g. before a pitch): open the site with ?reset */
export function resetMockDb() {
  db = fresh()
  save()
}

class HttpError {
  status: number
  message: string
  constructor(status: number, message: string) {
    this.status = status
    this.message = message
  }
}
const fail = (status: number, message: string): never => { throw new HttpError(status, message) }

const mini = (u: T.UserDto): T.UserMini => ({ id: u.id, username: u.username, name: u.name, avatar: u.avatar })
const brandMini = (b: T.Brand): T.BrandMini => ({ id: b.id, slug: b.slug, name: b.name, logo: b.logo, style: b.style, verified: b.verified, winner: b.winner })
const productMini = (p: T.Product): T.ProductMini => ({ id: p.id, name: p.name, image: p.images[0] ?? null, price: p.price, brand: p.brand })
const findProduct = (id: number) => db.products.find((p) => p.id === id) ?? fail(404, 'Product not found')
const findBrand = (key: string | number) =>
  db.brands.find((b) => String(b.id) === String(key) || b.slug === key) ?? fail(404, 'Brand not found')

function perUser(username: string): PerUser {
  if (!db.perUser[username]) {
    const u = db.users[username]
    db.perUser[username] = {
      me: { user: u, cartCount: 0, wishlistCount: 0, unreadCount: 0 },
      notifications: [{ id: ++db.seq, type: 'SYSTEM', message: 'Welcome to BrandMarket! Follow brands you like to fill your feed.', link: '/feed', image: null, actor: null, read: false, createdAt: now() }],
      liked: [], saved: [], reposted: [], following: [], cart: { items: [], count: 0, subtotal: 0, delivery: 0, total: 0 }, orders: [], votes: {},
    }
  }
  return db.perUser[username]
}

function view(p: T.Product, user: string | null): T.Product {
  if (!user) return { ...p, liked: false, saved: false, reposted: false }
  const pu = perUser(user)
  return { ...p, liked: pu.liked.includes(p.id), saved: pu.saved.includes(p.id), reposted: pu.reposted.includes(p.id) }
}
function brandView(b: T.Brand, user: string | null): T.Brand {
  return { ...b, following: !!user && perUser(user).following.includes(b.id) }
}
function userView(username: string): T.UserDto {
  const u = db.users[username] ?? fail(404, 'User not found')
  const pu = db.perUser[username]
  return { ...u, brands: db.brands.filter((b) => b.owner.username === username).map(brandMini), reposts: (db.reposts[username] ?? []).length, following: pu ? pu.following.length : u.following }
}
function meView(username: string): T.Me {
  const pu = perUser(username)
  return { user: userView(username), cartCount: pu.cart.count, wishlistCount: pu.saved.length, unreadCount: pu.notifications.filter((n) => !n.read).length }
}
function recalc(cart: T.Cart): T.Cart {
  for (const it of cart.items) {
    it.product = findProduct(it.product.id)
    it.lineTotal = it.product.price * it.quantity
  }
  const subtotal = cart.items.reduce((s, i) => s + i.lineTotal, 0)
  const delivery = !cart.items.length || subtotal >= 5000 ? 0 : 250
  return Object.assign(cart, { subtotal, delivery, total: subtotal + delivery, count: cart.items.reduce((s, i) => s + i.quantity, 0) })
}
function notify(username: string, n: Omit<T.AppNotification, 'id' | 'read' | 'createdAt'>) {
  if (db.users[username]) perUser(username).notifications.unshift({ ...n, id: ++db.seq, read: false, createdAt: now() })
}
const page = <V,>(items: V[], p: number, size: number): T.Page<V> => {
  const from = p * size
  return { items: items.slice(from, from + size), page: p, hasMore: from + size < items.length, total: items.length }
}
function syncOrder(o: T.Order) {
  for (const pu of Object.values(db.perUser)) {
    const i = pu.orders.findIndex((x) => x.id === o.id)
    if (i >= 0) pu.orders[i] = o
  }
}
function pollPercents(p: T.Poll) {
  p.totalVotes = p.options.reduce((s, o) => s + o.votes, 0)
  const sorted = [...p.options].sort((a, b) => b.votes - a.votes)
  for (const o of p.options) {
    o.percent = p.totalVotes ? Math.round((o.votes * 1000) / p.totalVotes) / 10 : 0
    o.rank = sorted.indexOf(o) + 1
  }
}

type Ctx = { method: string; path: string; params: Record<string, Any>; body: Any; user: string | null }
const need = (c: Ctx) => c.user ?? fail(401, 'Please sign in')

/* ── routes ─────────────────────────────────────────────────────────────── */
const routes: [string, RegExp, (c: Ctx, m: string[]) => Any][] = []
const on = (method: string, pattern: string, fn: (c: Ctx, m: string[]) => Any) =>
  routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn])

// auth & me
on('POST', '/auth/login', (c) => {
  const a = db.accounts.find((x) => x.email.toLowerCase() === String(c.body.email).trim().toLowerCase() && x.password === c.body.password)
  if (!a) fail(401, 'Wrong email or password')
  return { token: 'mock.' + a!.username, me: meView(a!.username) }
})
on('POST', '/auth/register', (c) => {
  const { name, username, email, password } = c.body
  if (!name?.trim() || !email?.includes('@')) fail(400, 'Please fill in all fields')
  if (!password || password.length < 6) fail(400, 'Password must be at least 6 characters')
  if (db.accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) fail(400, 'Email is already registered')
  const handle = String(username).toLowerCase()
  if (db.users[handle]) fail(400, 'Username is taken')
  db.users[handle] = { id: ++db.seq, username: handle, name: name.trim(), avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${handle}`, bio: null, role: 'USER', interests: [], onboarded: false, brands: [], reposts: 0, following: 0 }
  db.accounts.push({ email: email.toLowerCase(), password, username: handle })
  return { token: 'mock.' + handle, me: meView(handle) }
})
on('GET', '/me', (c) => meView(need(c)))
on('PUT', '/me', (c) => {
  const u = db.users[need(c)]
  if (c.body.name?.trim()) u.name = c.body.name.trim()
  if (c.body.bio != null) u.bio = c.body.bio || null
  if (c.body.avatar) u.avatar = c.body.avatar
  return meView(c.user!)
})
on('PUT', '/me/interests', (c) => {
  const u = db.users[need(c)]
  u.interests = (c.body.interests ?? []).filter((s: string) => db.styles.includes(s))
  u.onboarded = true
  return meView(c.user!)
})
on('GET', '/users/:u', (_c, [u]) => userView(decodeURIComponent(u).toLowerCase()))
on('GET', '/users/:u/reposts', (c, [u]) => (db.reposts[decodeURIComponent(u).toLowerCase()] ?? []).map((id) => view(findProduct(id), c.user)))
on('GET', '/meta/styles', () => db.styles)

// catalog
on('GET', '/home', (c) => ({ ...db.home, trending: db.home.trending.map((p) => view(findProduct(p.id), c.user)), fresh: db.home.fresh.map((p) => view(findProduct(p.id), c.user)), event: db.events.find((e) => e.active) ?? null }))
on('GET', '/products/facets', () => db.facets)
on('GET', '/products', (c) => {
  const q = c.params
  const text = String(q.q ?? '').trim().toLowerCase()
  let list = db.products.filter((p) =>
    (!text || [p.name, p.brand.name, p.type, p.brand.style, p.description ?? ''].some((s) => s.toLowerCase().includes(text))) &&
    (!q.type || p.type === q.type) && (!q.size || p.sizes.includes(q.size)) && (!q.style || p.brand.style === q.style) &&
    (!q.brandId || p.brand.id === Number(q.brandId)) && (q.minPrice == null || p.price >= Number(q.minPrice)) &&
    (q.maxPrice == null || p.price <= Number(q.maxPrice)) && (!q.inStock || String(q.inStock) !== 'true' || p.inStock))
  const sort = q.sort ?? 'popular'
  if (sort === 'new') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  else if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price || a.id - b.id)
  else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price || a.id - b.id)
  return page(list.map((p) => view(p, c.user)), Number(q.page ?? 0), Math.min(48, Number(q.pageSize ?? 12)))
})
on('GET', '/products/:id', (c, [id]) => view(findProduct(Number(id)), c.user))
on('GET', '/products/:id/related', (c, [id]) => {
  const p = findProduct(Number(id))
  const ids = db.related[id] ?? db.products.filter((x) => x.id !== p.id && (x.type === p.type || x.brand.id === p.brand.id)).slice(0, 8).map((x) => x.id)
  return ids.map((i) => db.products.find((x) => x.id === i)).filter(Boolean).map((x) => view(x!, c.user))
})
on('GET', '/feed', (c) => {
  const order = [...db.products.filter((p) => !db.feedOrder.includes(p.id)).map((p) => p.id), ...db.feedOrder]
  let list = order.map((id) => db.products.find((p) => p.id === id)).filter(Boolean) as T.Product[]
  if (c.params.tab === 'following') {
    const f = c.user ? perUser(c.user).following : []
    list = list.filter((p) => f.includes(p.brand.id))
  }
  return page(list.map((p) => view(p, c.user)), Number(c.params.page ?? 0), 6)
})
on('GET', '/search', (c) => {
  const t = String(c.params.q ?? '').toLowerCase()
  return {
    products: db.products.filter((p) => p.name.toLowerCase().includes(t) || p.brand.name.toLowerCase().includes(t)).map((p) => view(p, c.user)),
    brands: db.brands.filter((b) => b.name.toLowerCase().includes(t)).map((b) => brandView(b, c.user)),
    people: Object.values(db.users).filter((u) => u.name.toLowerCase().includes(t) || u.username.includes(t)).slice(0, 8).map(mini),
  }
})
on('GET', '/search/suggest', (c) => {
  const t = String(c.params.q ?? '').toLowerCase()
  if (t.length < 2) return []
  const brands = db.brands.filter((b) => b.name.toLowerCase().includes(t)).slice(0, 3)
    .map((b) => ({ kind: 'BRAND', id: b.id, title: b.name, subtitle: b.style, image: b.logo, link: `/b/${b.slug}` }))
  const products = db.products.filter((p) => p.name.toLowerCase().includes(t) || p.type.toLowerCase().includes(t)).slice(0, 5)
    .map((p) => ({ kind: 'PRODUCT', id: p.id, title: p.name, subtitle: `${p.brand.name} · ${Math.round(p.price).toLocaleString('en-US')} som`, image: p.images[0], link: `/p/${p.id}` }))
  return [...brands, ...products]
})

// brands
on('GET', '/brands', (c) => db.brands.map((b) => brandView(b, c.user)))
on('GET', '/brands/:key', (c, [key]) => brandView(findBrand(decodeURIComponent(key)), c.user))
on('GET', '/brands/:key/products', (c, [key]) => {
  const b = findBrand(decodeURIComponent(key))
  return db.products.filter((p) => p.brand.id === b.id).map((p) => view(p, c.user))
})
on('POST', '/brands', (c) => {
  const owner = db.users[need(c)]
  const name = String(c.body.name ?? '').trim()
  if (!name) fail(400, 'Brand name is required')
  if (db.brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) fail(400, 'Brand name is taken')
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'
  let slug = base
  for (let i = 2; db.brands.some((b) => b.slug === slug); i++) slug = `${base}-${i}`
  const b: T.Brand = { id: ++db.seq, slug, name, description: c.body.description || null, logo: c.body.logo || null, banner: c.body.banner || null, style: c.body.style || 'Streetwear', verified: false, winner: false, isNew: true, owner: mini(owner), followers: 0, likes: 0, sales: 0, productsCount: 0, rating: null, following: false, cover: null, createdAt: now() }
  db.brands.push(b)
  return b
})
on('POST', '/brands/:id/products', (c, [id]) => {
  const b = findBrand(id)
  if (b.owner.username !== need(c) && db.users[c.user!].role !== 'ADMIN') fail(403, 'This is not your brand')
  const x = c.body
  if (!x.name?.trim() || !(x.price > 0) || !x.images?.length || !x.sizes?.length) fail(400, 'Please fill in all fields')
  const p: T.Product = { id: ++db.seq, name: x.name.trim(), description: x.description || null, price: Number(x.price), images: x.images, videoUrl: null, brand: brandMini(b), type: x.type, sizes: x.sizes, colors: x.colors ?? [], stock: Number(x.stock), inStock: Number(x.stock) > 0, views: 0, sales: 0, likes: 0, comments: 0, reviews: 0, rating: null, saves: 0, liked: false, saved: false, reposted: false, badges: ['NEW'], createdAt: now() }
  db.products.unshift(p)
  db.reviews[p.id] = { average: null, count: 0, histogram: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, canReview: false, reviewed: false, items: [] }
  db.comments[p.id] = []
  b.productsCount++
  return p
})
on('GET', '/dashboard/:id', (c, [id]) => {
  need(c)
  const b = findBrand(id)
  if (db.dashboards[id]) return { ...db.dashboards[id], brand: b }
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10))
  return {
    brand: b,
    metrics: ['revenue', 'orders', 'views', 'followers', 'likes', 'conversion', 'rating', 'avgOrder'].map((key) => ({ key, value: 0, delta: null })),
    series: days.map((date) => ({ date, views: 0, orders: 0, revenue: 0, followers: 0, likes: 0 })),
    topProducts: db.products.filter((p) => p.brand.id === b.id).map((p) => ({ product: productMini(p), views: 0, sales: 0, likes: 0 })),
    pipeline: Object.fromEntries(STAGES.map((s) => [s, 0])), recentOrders: [],
  }
})

// social
const toggle = (list: number[], id: number) => {
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
  return i < 0
}
on('POST', '/products/:id/like', (c, [id]) => {
  const p = findProduct(Number(id))
  const active = toggle(perUser(need(c)).liked, p.id)
  p.likes += active ? 1 : -1
  return { active, count: p.likes }
})
on('POST', '/products/:id/repost', (c, [id]) => {
  const p = findProduct(Number(id))
  const active = toggle(perUser(need(c)).reposted, p.id)
  const list = (db.reposts[c.user!] ??= [])
  if (active) list.unshift(p.id)
  else list.splice(list.indexOf(p.id), 1)
  return { active, count: list.length }
})
on('POST', '/brands/:id/follow', (c, [id]) => {
  const b = findBrand(id)
  const active = toggle(perUser(need(c)).following, b.id)
  b.followers += active ? 1 : -1
  if (active) notify(b.owner.username, { type: 'FOLLOW', message: `${db.users[c.user!].name} started following ${b.name}`, link: `/u/${c.user}`, image: null, actor: mini(db.users[c.user!]) })
  return { active, count: b.followers }
})
on('GET', '/wishlist', (c) => perUser(need(c)).saved.map((id) => db.products.find((p) => p.id === id)).filter(Boolean).reverse().map((p) => view(p!, c.user)))
on('POST', '/wishlist/:id', (c, [id]) => {
  const p = findProduct(Number(id))
  const active = toggle(perUser(need(c)).saved, p.id)
  p.saves = Math.max(0, p.saves + (active ? 1 : -1))
  return { active, count: p.saves }
})
on('GET', '/products/:id/comments', (_c, [id]) => db.comments[id] ?? [])
on('POST', '/products/:id/comments', (c, [id]) => {
  const p = findProduct(Number(id))
  const text = String(c.body.text ?? '').trim()
  if (!text) fail(400, 'Comment is empty')
  const cm: T.Comment = { id: ++db.seq, user: mini(db.users[need(c)]), text, createdAt: now() }
  ;(db.comments[id] ??= []).unshift(cm)
  p.comments++
  return cm
})
on('GET', '/products/:id/reviews', (c, [id]) => {
  const s = db.reviews[id] ?? { average: null, count: 0, histogram: {}, canReview: false, reviewed: false, items: [] }
  const bought = !!c.user && perUser(c.user).orders.some((o) => o.product.id === Number(id))
  const reviewed = !!c.user && s.items.some((r) => r.user.username === c.user)
  return { ...s, canReview: bought && !reviewed, reviewed }
})
on('POST', '/products/:id/reviews', (c, [id]) => {
  const p = findProduct(Number(id))
  const s = db.reviews[id]
  const rating = Number(c.body.rating)
  if (!(rating >= 1 && rating <= 5)) fail(400, 'Pick a rating')
  const r: T.Review = { id: ++db.seq, user: mini(db.users[need(c)]), rating, text: c.body.text || null, size: c.body.size ?? null, createdAt: now() }
  s.items.unshift(r)
  s.count++
  s.histogram[rating] = (s.histogram[rating] ?? 0) + 1
  s.average = Math.round((s.items.reduce((t, x) => t + x.rating, 0) / s.items.length) * 10) / 10
  p.reviews = s.count
  p.rating = s.average
  return r
})
on('POST', '/share', (c) => {
  const code = Math.random().toString(36).slice(2, 8)
  const isProduct = c.body.type === 'PRODUCT'
  const t = isProduct ? findProduct(Number(c.body.id)) : findBrand(c.body.id)
  return { code, path: isProduct ? `/p/${t.id}` : `/b/${(t as T.Brand).slug}`, targetType: c.body.type, targetId: t.id, title: t.name, image: isProduct ? (t as T.Product).images[0] : (t as T.Brand).logo, clicks: 0 }
})

// notifications
on('GET', '/notifications', (c) => perUser(need(c)).notifications)
on('GET', '/notifications/unread-count', (c) => ({ count: perUser(need(c)).notifications.filter((n) => !n.read).length }))
on('POST', '/notifications/read-all', (c) => { perUser(need(c)).notifications.forEach((n) => (n.read = true)); return null })
on('POST', '/notifications/:id/read', (c, [id]) => { const n = perUser(need(c)).notifications.find((x) => x.id === Number(id)); if (n) n.read = true; return null })

// cart & orders
on('GET', '/cart', (c) => recalc(perUser(need(c)).cart))
on('POST', '/cart', (c) => {
  const cart = perUser(need(c)).cart
  const p = findProduct(Number(c.body.productId))
  if (!p.inStock) fail(400, 'This item is sold out')
  const qty = Math.max(1, Math.min(20, Number(c.body.quantity ?? 1)))
  const same = cart.items.find((i) => i.product.id === p.id && i.size === (c.body.size ?? null) && i.color === (c.body.color ?? null))
  if (same) same.quantity = Math.min(20, same.quantity + qty)
  else cart.items.push({ id: ++db.seq, product: p, size: c.body.size ?? null, color: c.body.color ?? null, quantity: qty, lineTotal: 0 })
  return recalc(cart)
})
on('PATCH', '/cart/:id', (c, [id]) => {
  const cart = perUser(need(c)).cart
  const it = cart.items.find((i) => i.id === Number(id)) ?? fail(404, 'Item not found')
  it.quantity = Math.max(1, Math.min(20, Number(c.params.quantity)))
  return recalc(cart)
})
on('DELETE', '/cart/:id', (c, [id]) => {
  const cart = perUser(need(c)).cart
  cart.items = cart.items.filter((i) => i.id !== Number(id))
  return recalc(cart)
})
on('POST', '/orders/checkout', (c) => {
  const user = need(c)
  const pu = perUser(user)
  if (!pu.cart.items.length) fail(400, 'Your bag is empty')
  if (!c.body.phone || !c.body.address) fail(400, 'Please fill in contact details')
  const due = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
  const created = pu.cart.items.map((it) => {
    const p = findProduct(it.product.id)
    p.sales += it.quantity
    const o: T.Order = { id: ++db.seq, code: `BM-${db.seq % 100000}`, product: productMini(p), buyer: mini(db.users[user]), quantity: it.quantity, size: it.size, color: it.color, total: it.lineTotal, address: c.body.address, phone: c.body.phone, deliveryType: c.body.deliveryType, status: 'NEW', stageIndex: 0, priority: 'NORMAL', assignee: null, note: null, createdAt: now(), statusChangedAt: now(), dueDate: due }
    db.board.unshift(o)
    pu.orders.unshift(o)
    const owner = findBrand(p.brand.id).owner.username
    notify(owner, { type: 'NEW_ORDER', message: `New order ${o.code}: ${p.name}`, link: '/dashboard', image: p.images[0], actor: mini(db.users[user]) })
    return o
  })
  pu.cart = { items: [], count: 0, subtotal: 0, delivery: 0, total: 0 }
  notify(user, { type: 'ORDER_STATUS', message: `Order received — it's already on the factory board`, link: '/orders', image: created[0].product.image, actor: null })
  return created
})
on('GET', '/orders', (c) => perUser(need(c)).orders)
on('GET', '/orders/:id', (c, [id]) => {
  const o = perUser(need(c)).orders.find((x) => x.id === Number(id)) ?? fail(404, 'Order not found')
  return { order: o, timeline: [{ status: o.status, actor: null, createdAt: o.statusChangedAt }] }
})
on('POST', '/orders/:id/reorder', (c, [id]) => {
  const pu = perUser(need(c))
  const o = pu.orders.find((x) => x.id === Number(id)) ?? fail(404, 'Order not found')
  pu.cart.items.push({ id: ++db.seq, product: findProduct(o.product.id), size: o.size, color: o.color, quantity: o.quantity, lineTotal: 0 })
  return recalc(pu.cart)
})

// events
on('GET', '/events/current', (c) => {
  const e = db.events.find((x) => x.active)
  return e ? { ...e, myOptionId: c.user ? perUser(c.user).votes[e.id] ?? null : null } : null
})
on('GET', '/events', (c) => db.events.map((e) => ({ ...e, myOptionId: c.user ? perUser(c.user).votes[e.id] ?? null : null })))
on('GET', '/events/:id', (_c, [id]) => db.events.find((e) => e.id === Number(id)) ?? fail(404, 'Event not found'))
on('POST', '/events/:id/vote/:opt', (c, [id, opt]) => {
  const e = db.events.find((x) => x.id === Number(id)) ?? fail(404, 'Event not found')
  if (!e.active) fail(400, 'Voting is closed')
  const pu = perUser(need(c))
  const prev = pu.votes[e.id]
  if (prev) { const o = e.options.find((x) => x.id === prev); if (o) o.votes-- }
  const o = e.options.find((x) => x.id === Number(opt)) ?? fail(404, 'Option not found')
  o.votes++
  pu.votes[e.id] = o.id
  pollPercents(e)
  return { ...e, myOptionId: o.id }
})

// factory
const staff = (c: Ctx) => { const r = db.users[need(c)].role; if (r !== 'WORKER' && r !== 'ADMIN') fail(403, 'Factory staff only') }
on('GET', '/factory/orders', (c) => { staff(c); return db.board })
on('GET', '/factory/workers', (c) => { staff(c); return db.workers })
on('PATCH', '/factory/orders/:id/status', (c, [id]) => {
  staff(c)
  const o = db.board.find((x) => x.id === Number(id)) ?? fail(404, 'Order not found')
  const status = c.body.status as T.Stage
  if (!STAGES.includes(status)) fail(400, 'Unknown stage')
  Object.assign(o, { status, stageIndex: STAGES.indexOf(status), statusChangedAt: now() })
  syncOrder(o)
  notify(o.buyer.username, { type: 'ORDER_STATUS', message: `Your ${o.product.name} moved to ${status.charAt(0) + status.slice(1).toLowerCase()}`, link: '/orders', image: o.product.image, actor: null })
  return o
})
on('PATCH', '/factory/orders/:id', (c, [id]) => {
  staff(c)
  const o = db.board.find((x) => x.id === Number(id)) ?? fail(404, 'Order not found')
  if (c.body.priority) o.priority = c.body.priority
  if (c.body.assigneeId) o.assignee = db.workers.find((w) => w.id === Number(c.body.assigneeId)) ?? o.assignee
  if (c.body.note != null) o.note = c.body.note || null
  syncOrder(o)
  return o
})

// admin
const adminOnly = (c: Ctx) => { if (db.users[need(c)].role !== 'ADMIN') fail(403, 'Admins only') }
on('GET', '/admin/stats', (c) => { adminOnly(c); return { ...db.adminStats, brands: db.brands.length, verifiedBrands: db.brands.filter((b) => b.verified).length, products: db.products.length } })
on('GET', '/admin/brand-of-day', (c) => { adminOnly(c); return { brandId: db.home.brandOfDay?.brand.id ?? null } })
on('PATCH', '/admin/brands/:id/verify', (c, [id]) => {
  adminOnly(c)
  const b = findBrand(id)
  b.verified = String(c.params.verified) === 'true'
  for (const p of db.products) if (p.brand.id === b.id) p.brand = { ...p.brand, verified: b.verified }
  return b
})
on('POST', '/admin/brands/:id/feature', (c, [id]) => {
  adminOnly(c)
  const b = findBrand(id)
  db.home.brandOfDay = { brand: b, products: db.products.filter((p) => p.brand.id === b.id).slice(0, 4) }
  return b
})
on('POST', '/admin/events', (c) => {
  adminOnly(c)
  const brands = (c.body.brandIds ?? []).map((id: number) => findBrand(id))
  if (!c.body.title || brands.length < 2) fail(400, 'Title and at least 2 brands are required')
  const p: T.Poll = { id: ++db.seq, title: c.body.title, description: c.body.description || null, prize: c.body.prize || null, cover: null, active: true, endsAt: c.body.endsAt, totalVotes: 0, myOptionId: null, winner: null, options: brands.map((b: T.Brand, i: number) => ({ id: ++db.seq, brand: b, votes: 0, percent: 0, rank: i + 1 })) }
  db.events.unshift(p)
  return p
})
on('POST', '/admin/events/:id/close', (c, [id]) => {
  adminOnly(c)
  const e = db.events.find((x) => x.id === Number(id)) ?? fail(404, 'Event not found')
  e.active = false
  const top = [...e.options].sort((a, b) => b.votes - a.votes)[0]
  if (top) { e.winner = brandMini(top.brand); findBrand(top.brand.id).winner = true }
  return e
})

/* ── adapter ────────────────────────────────────────────────────────────── */
const readFile = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })

/** Downscale uploads so localStorage can hold them. */
async function shrink(file: Blob): Promise<string> {
  const src = await readFile(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
    const k = Math.min(1, 900 / Math.max(img.width, img.height))
    const cv = document.createElement('canvas')
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k)
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', 0.82)
  } catch {
    return src
  }
}

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase()
  const path = (config.url ?? '').replace(/^\/api/, '').split('?')[0]
  const auth = String(config.headers?.Authorization ?? '')
  const tokenUser = auth.startsWith('Bearer mock.') ? auth.slice('Bearer mock.'.length) : null
  const user = tokenUser && db.users[tokenUser] ? tokenUser : null
  const respond = (status: number, data: Any): AxiosResponse => ({ data, status, statusText: String(status), headers: new AxiosHeaders(), config })

  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180)) // feels like a real network

  try {
    if (method === 'POST' && path === '/uploads') {
      const file = (config.data as FormData).get('file') as Blob
      return respond(200, { url: await shrink(file) })
    }
    let body: Any = config.data
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* raw */ } }
    for (const [m, re, fn] of routes) {
      const match = m === method && path.match(re)
      if (match) {
        if (auth.startsWith('Bearer ') && !user && path !== '/auth/login' && path !== '/auth/register') fail(401, 'Session expired')
        const data = fn({ method, path, params: config.params ?? {}, body: body ?? {}, user }, match.slice(1))
        if (method !== 'GET') save()
        if (data === null && path === '/events/current') return respond(204, '')
        return respond(200, clone(data ?? ''))
      }
    }
    fail(404, 'Not found')
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const message = e instanceof HttpError ? e.message : 'Something went wrong'
    if (!(e instanceof HttpError)) console.error(e)
    throw new AxiosError(message, String(status), config, null, respond(status, { message, status }))
  }
  throw new Error('unreachable')
}
