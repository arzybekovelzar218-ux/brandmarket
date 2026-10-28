import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Page } from '../layout/AppShell'

export default function NotFoundPage() {
  return (
    <Page className="grid min-h-[70vh] place-items-center text-center">
      <div>
        <p className="font-display text-[96px] font-bold leading-none tracking-[-0.05em] text-surface-3">404</p>
        <h1 className="mt-4 text-3xl font-bold">This page went out of stock</h1>
        <p className="mt-2 text-muted">The link may be old, or the piece was removed.</p>
        <Link to="/"><Button variant="ink" className="mt-7">Back to shop</Button></Link>
      </div>
    </Page>
  )
}
