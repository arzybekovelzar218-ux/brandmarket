// Mirrors backend com.brandmarket.dto.Dtos

export interface UserMini { id: number; username: string; name: string; avatar: string | null }

export interface BrandMini {
  id: number; slug: string; name: string; logo: string | null; style: string; verified: boolean; winner: boolean
}

export type Role = 'USER' | 'WORKER' | 'ADMIN'

export interface UserDto {
  id: number; username: string; name: string; avatar: string | null; bio: string | null; role: Role
  interests: string[]; onboarded: boolean; brands: BrandMini[]; reposts: number; following: number
}

export interface Me { user: UserDto; cartCount: number; wishlistCount: number; unreadCount: number }
export interface AuthResponse { token: string; me: Me }

export interface Brand {
  id: number; slug: string; name: string; description: string | null; logo: string | null; banner: string | null
  style: string; verified: boolean; winner: boolean; isNew: boolean; owner: UserMini
  followers: number; likes: number; sales: number; productsCount: number; rating: number | null
  following: boolean; cover: string | null; createdAt: string
}

export type Badge = 'NEW' | 'HOT' | 'WINNER'

export interface Product {
  id: number; name: string; description: string | null; price: number; images: string[]; videoUrl: string | null
  brand: BrandMini; type: string; sizes: string[]; colors: string[]; stock: number; inStock: boolean
  views: number; sales: number; likes: number; comments: number; reviews: number; rating: number | null; saves: number
  liked: boolean; saved: boolean; reposted: boolean; badges: Badge[]; createdAt: string
}

export interface Page<T> { items: T[]; page: number; hasMore: boolean; total: number }
export interface Facets { types: string[]; sizes: string[]; styles: string[]; minPrice: number; maxPrice: number }
export interface Toggle { active: boolean; count: number }

export interface Comment { id: number; user: UserMini; text: string; createdAt: string }
export interface Review { id: number; user: UserMini; rating: number; text: string | null; size: string | null; createdAt: string }
export interface ReviewSummary {
  average: number | null; count: number; histogram: Record<string, number>; canReview: boolean; reviewed: boolean; items: Review[]
}

export interface Share { code: string; path: string; targetType: 'PRODUCT' | 'BRAND'; targetId: number; title: string; image: string | null; clicks: number }
export interface Suggestion { kind: 'BRAND' | 'PRODUCT' | 'USER'; id: number; title: string; subtitle: string | null; image: string | null; link: string }
export interface SearchResult { products: Product[]; brands: Brand[]; people: UserMini[] }

export type NotificationType = 'LIKE' | 'FOLLOW' | 'COMMENT' | 'NEW_ORDER' | 'ORDER_STATUS' | 'REVIEW' | 'EVENT' | 'SYSTEM'
export interface AppNotification {
  id: number; type: NotificationType; message: string; link: string | null; image: string | null
  actor: UserMini | null; read: boolean; createdAt: string
}

export interface CartItem { id: number; product: Product; size: string | null; color: string | null; quantity: number; lineTotal: number }
export interface Cart { items: CartItem[]; count: number; subtotal: number; delivery: number; total: number }

export const STAGES = ['NEW', 'MATERIALS', 'PRINTING', 'SEWING', 'QUALITY', 'PACKAGING', 'SHIPPING', 'DONE'] as const
export type Stage = (typeof STAGES)[number]
export type OrderStatus = Stage | 'CANCELLED'

export interface ProductMini { id: number; name: string; image: string | null; price: number; brand: BrandMini }
export interface Order {
  id: number; code: string; product: ProductMini; buyer: UserMini; quantity: number; size: string | null; color: string | null
  total: number; address: string | null; phone: string | null; deliveryType: string | null; status: OrderStatus
  stageIndex: number; priority: 'NORMAL' | 'URGENT'; assignee: UserMini | null; note: string | null
  createdAt: string; statusChangedAt: string; dueDate: string
}
export interface OrderDetail { order: Order; timeline: { status: OrderStatus; actor: UserMini | null; createdAt: string }[] }

export interface PollOption { id: number; brand: Brand; votes: number; percent: number; rank: number }
export interface Poll {
  id: number; title: string; description: string | null; prize: string | null; cover: string | null; active: boolean
  endsAt: string; totalVotes: number; myOptionId: number | null; winner: BrandMini | null; options: PollOption[]
}

export interface Home {
  trending: Product[]; fresh: Product[]; newBrands: Brand[]
  brandOfDay: { brand: Brand; products: Product[] } | null; event: Poll | null; categories: string[]
  brandsCount: number; productsCount: number
}

export interface Point { date: string; views: number; orders: number; revenue: number; followers: number; likes: number }
export interface Metric { key: string; value: number; delta: number | null }
export interface Dashboard {
  brand: Brand; metrics: Metric[]; series: Point[]
  topProducts: { product: ProductMini; views: number; sales: number; likes: number }[]
  pipeline: Record<Stage, number>; recentOrders: Order[]
}
export interface AdminStats {
  users: number; brands: number; verifiedBrands: number; products: number; orders: number; revenue: number
  ordersByStatus: Record<Stage, number>; series: Point[]
  topBrands: { brand: BrandMini; revenue: number; followers: number; orders: number }[]
}
