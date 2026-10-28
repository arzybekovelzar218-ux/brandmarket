import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Demo build: open the site with ?reset to wipe changes made during rehearsals
if (import.meta.env.VITE_MOCK === 'true' && new URLSearchParams(location.search).has('reset')) {
  try {
    localStorage.removeItem('bm-mock-db-v2')
    localStorage.removeItem('bm-token')
  } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
