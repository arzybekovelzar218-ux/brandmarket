import axios, { AxiosError } from 'axios'
import { API_ORIGIN } from '../lib/url'

export const TOKEN_KEY = 'bm-token'

// generous timeout: a sleeping free-tier backend can take ~50s to wake up
export const http = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 60000 })

// Backend-less demo build: answer every request in the browser from bundled demo data
if (import.meta.env.VITE_MOCK === 'true') {
  http.defaults.adapter = async (config) => (await import('../mock/server')).mockAdapter(config)
}

http.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    /* storage unavailable */
  }
  return config
})

/** Human-readable message from an API error. */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof AxiosError) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
    if (!e.response) return 'Server is not reachable'
  }
  return fallback
}

export const isUnauthorized = (e: unknown) => e instanceof AxiosError && e.response?.status === 401
