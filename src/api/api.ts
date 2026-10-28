import { http } from './client'
import type * as T from './types'

const get = <R,>(url: string, params?: object) => http.get<R>(url, { params }).then((r) => r.data)
const post = <R,>(url: string, body?: object) => http.post<R>(url, body).then((r) => r.data)
const put = <R,>(url: string, body?: object) => http.put<R>(url, body).then((r) => r.data)
const patch = <R,>(url: string, body?: object, params?: object) => http.patch<R>(url, body, { params }).then((r) => r.data)
const del = <R,>(url: string) => http.delete<R>(url).then((r) => r.data)

export interface CatalogQuery {
  q?: string; type?: string; size?: string; style?: string; brandId?: number
  minPrice?: number; maxPrice?: number; inStock?: boolean; sort?: string; page?: number; pageSize?: number
}

export interface ProductInput {
  name: string; description: string; price: number; images: string[]; type: string; sizes: string[]; colors: string[]; stock: number
}

export const api = {
  login: (email: string, password: string) => post<T.AuthResponse>('/auth/login', { email, password }),
  register: (b: { name: string; username: string; email: string; password: string }) => post<T.AuthResponse>('/auth/register', b),
  me: () => get<T.Me>('/me'),
  setInterests: (interests: string[]) => put<T.Me>('/me/interests', { interests }),
  user: (username: string) => get<T.UserDto>(`/users/${username}`),
  userReposts: (username: string) => get<T.Product[]>(`/users/${username}/reposts`),
  updateMe: (b: { name?: string; bio?: string; avatar?: string }) => put<T.Me>('/me', b),
  styles: () => get<string[]>('/meta/styles'),

  home: () => get<T.Home>('/home'),
  products: (q: CatalogQuery) => get<T.Page<T.Product>>('/products', q),
  facets: () => get<T.Facets>('/products/facets'),
  product: (id: number) => get<T.Product>(`/products/${id}`),
  related: (id: number) => get<T.Product[]>(`/products/${id}/related`),
  feed: (tab: 'foryou' | 'following', page: number) => get<T.Page<T.Product>>('/feed', { tab, page }),
  search: (q: string) => get<T.SearchResult>('/search', { q }),
  suggest: (q: string) => get<T.Suggestion[]>('/search/suggest', { q }),

  brands: () => get<T.Brand[]>('/brands'),
  brand: (slug: string) => get<T.Brand>(`/brands/${slug}`),
  brandProducts: (slug: string) => get<T.Product[]>(`/brands/${slug}/products`),
  dashboard: (brandId: number) => get<T.Dashboard>(`/dashboard/${brandId}`),
  createBrand: (b: { name: string; description: string; style: string; logo?: string; banner?: string }) => post<T.Brand>('/brands', b),
  addProduct: (brandId: number, b: ProductInput) => post<T.Product>(`/brands/${brandId}/products`, b),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post<{ url: string }>('/uploads', fd).then((r) => r.data.url)
  },

  like: (id: number) => post<T.Toggle>(`/products/${id}/like`),
  repost: (id: number) => post<T.Toggle>(`/products/${id}/repost`),
  follow: (brandId: number) => post<T.Toggle>(`/brands/${brandId}/follow`),
  comments: (id: number) => get<T.Comment[]>(`/products/${id}/comments`),
  addComment: (id: number, text: string) => post<T.Comment>(`/products/${id}/comments`, { text }),
  reviews: (id: number) => get<T.ReviewSummary>(`/products/${id}/reviews`),
  addReview: (id: number, b: { rating: number; text: string; size?: string | null }) => post<T.Review>(`/products/${id}/reviews`, b),
  wishlist: () => get<T.Product[]>('/wishlist'),
  toggleWishlist: (id: number) => post<T.Toggle>(`/wishlist/${id}`),
  share: (type: 'PRODUCT' | 'BRAND', id: number) => post<T.Share>('/share', { type, id }),

  notifications: () => get<T.AppNotification[]>('/notifications'),
  readAll: () => post<void>('/notifications/read-all'),

  cart: () => get<T.Cart>('/cart'),
  addToCart: (b: { productId: number; size?: string | null; color?: string | null; quantity?: number }) => post<T.Cart>('/cart', b),
  setQty: (itemId: number, quantity: number) => patch<T.Cart>(`/cart/${itemId}`, undefined, { quantity }),
  removeFromCart: (itemId: number) => del<T.Cart>(`/cart/${itemId}`),
  checkout: (b: { address: string; phone: string; deliveryType: string }) => post<T.Order[]>('/orders/checkout', b),
  orders: () => get<T.Order[]>('/orders'),

  currentEvent: () => http.get<T.Poll>('/events/current').then((r) => (r.status === 204 ? null : r.data)),
  events: () => get<T.Poll[]>('/events'),
  vote: (pollId: number, optionId: number) => post<T.Poll>(`/events/${pollId}/vote/${optionId}`),

  board: () => get<T.Order[]>('/factory/orders'),
  workers: () => get<T.UserMini[]>('/factory/workers'),
  moveOrder: (id: number, status: string) => patch<T.Order>(`/factory/orders/${id}/status`, { status }),
  patchOrder: (id: number, b: { priority?: string; assigneeId?: number; note?: string }) => patch<T.Order>(`/factory/orders/${id}`, b),

  adminStats: () => get<T.AdminStats>('/admin/stats'),
  verify: (id: number, verified: boolean) => patch<T.Brand>(`/admin/brands/${id}/verify`, undefined, { verified }),
  feature: (id: number) => post<T.Brand>(`/admin/brands/${id}/feature`),
  createEvent: (b: { title: string; description: string; prize: string; endsAt: string; brandIds: number[] }) => post<T.Poll>('/admin/events', b),
  closeEvent: (id: number) => post<T.Poll>(`/admin/events/${id}/close`),
}
