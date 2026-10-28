import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

/** Wraps an action so guests are sent to /login (and come back afterwards). */
export function useGate() {
  const me = useAuth((s) => s.me)
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    <A extends unknown[]>(fn: (...a: A) => unknown) =>
      (...a: A) => {
        if (!me) {
          navigate('/login', { state: { from: location.pathname + location.search } })
          return
        }
        return fn(...a)
      },
    [me, navigate, location],
  )
}
