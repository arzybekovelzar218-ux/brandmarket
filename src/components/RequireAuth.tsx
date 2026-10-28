import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../store/auth'

/** Guests go to /login; users without the role go home. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { me, ready } = useAuth()
  const location = useLocation()
  if (!ready) return null
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(me.user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
