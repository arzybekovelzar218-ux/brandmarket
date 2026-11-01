/**
 * Backend origin. Empty in dev (Vite proxies /api, /uploads, /videos).
 * In production set VITE_API_URL, e.g. https://brandmarket-api.onrender.com
 */
export const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '')

/** Backend-relative media paths (/uploads/…, /videos/…) → absolute URL on the API origin. */
/** Absolute link to an in-app page, respecting a sub-path deploy (GitHub Pages). */
export const pageUrl = (path: string) => location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + path

export const media = (src?: string | null) => {
  if (!src) return src ?? undefined
  // The seeded catalogue ships with the frontend, not the API.
  if (src.startsWith('/catalog/')) return import.meta.env.BASE_URL + src.slice(1)
  return src.startsWith('/') && !src.startsWith('//') ? API_ORIGIN + src : src
}
