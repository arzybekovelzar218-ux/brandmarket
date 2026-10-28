import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './layout/AppShell'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import { useAuth } from './store/auth'
import { useCart } from './store/cart'

const ProductPage = lazy(() => import('./pages/ProductPage'))
const FeedPage = lazy(() => import('./pages/FeedPage'))
const BrandPage = lazy(() => import('./pages/BrandPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const FactoryPage = lazy(() => import('./pages/FactoryPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const CreatePage = lazy(() => import('./pages/CreatePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** /account → your own public profile. */
function MyProfile() {
  const username = useAuth((s) => s.me?.user.username)
  return username ? <Navigate to={`/u/${username}`} replace /> : null
}

export default function App() {
  const init = useAuth((s) => s.init)
  const loadCart = useCart((s) => s.load)

  useEffect(() => {
    init().then(() => useAuth.getState().me && loadCart())
  }, [init, loadCart])

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key !== '/' || t.closest('input, textarea, select, [contenteditable]')) return
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Search"]')
      if (input) { e.preventDefault(); input.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/welcome" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="p/:id" element={<ProductPage />} />
          <Route path="b/:slug" element={<BrandPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="u/:username" element={<ProfilePage />} />
          <Route path="account" element={<RequireAuth><MyProfile /></RequireAuth>} />
          <Route path="create" element={<RequireAuth><CreatePage /></RequireAuth>} />
          <Route path="dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="factory" element={<RequireAuth roles={['WORKER', 'ADMIN']}><FactoryPage /></RequireAuth>} />
          <Route path="admin" element={<RequireAuth roles={['ADMIN']}><AdminPage /></RequireAuth>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
