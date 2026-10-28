import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { money } from '../lib/format'
import { ease } from '../lib/motion'
import { useCart } from '../store/cart'
import { Button } from './ui/Button'
import { Img } from './ui/Img'
import { Skeleton } from './ui/Skeleton'

export function CartDrawer() {
  const { cart, open, setOpen, load, setQty, remove } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-label="Shopping bag"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col bg-surface shadow-pop"
          >
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <div>
                <h2 className="text-2xl font-bold">Your bag</h2>
                {cart && <p className="mt-0.5 text-[13px] text-muted">{cart.count} {cart.count === 1 ? 'item' : 'items'}</p>}
              </div>
              <Button variant="soft" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="size-[18px]" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              {!cart &&
                Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex gap-4 border-t border-line py-5">
                    <Skeleton className="h-28 w-[84px] rounded-xl" />
                    <div className="flex-1 space-y-2.5 pt-1"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/4" /></div>
                  </div>
                ))}

              {cart?.items.length === 0 && (
                <div className="grid h-full place-items-center pb-20 text-center">
                  <div>
                    <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-2">
                      <ShoppingBag className="size-6 text-muted" strokeWidth={1.5} />
                    </div>
                    <p className="mt-5 font-display text-lg font-semibold">Your bag is empty</p>
                    <p className="mt-1.5 text-[14px] text-muted">Pieces you add will show up here.</p>
                    <Button variant="ink" className="mt-6" onClick={() => { setOpen(false); navigate('/') }}>Start shopping</Button>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {cart?.items.map((it) => (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                    className="flex gap-4 border-t border-line py-5 first:border-t-0"
                  >
                    <Link to={`/p/${it.product.id}`} onClick={() => setOpen(false)} className="shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      <Img src={it.product.images[0]} alt={it.product.name} className="h-28 w-[84px] object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{it.product.brand.name}</p>
                          <p className="mt-0.5 truncate text-[14px] text-fg-2">{it.product.name}</p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                            {it.size && <span>Size {it.size}</span>}
                            {it.color && <span className="inline-block size-3 rounded-full ring-1 ring-line-strong" style={{ background: it.color }} />}
                          </p>
                        </div>
                        <button onClick={() => remove(it.id)} aria-label="Remove" className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex h-9 items-center rounded-full border border-line-strong">
                          <button aria-label="Decrease" disabled={it.quantity <= 1} onClick={() => setQty(it.id, it.quantity - 1)} className="grid size-9 place-items-center text-muted hover:text-fg disabled:opacity-30">
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-6 text-center text-[13px] font-semibold tabular">{it.quantity}</span>
                          <button aria-label="Increase" onClick={() => setQty(it.id, it.quantity + 1)} className="grid size-9 place-items-center text-muted hover:text-fg">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="text-[14px] font-semibold tabular">{money(it.lineTotal)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {cart && cart.items.length > 0 && (
              <div className="border-t border-line px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
                <dl className="space-y-2 text-[14px]">
                  <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd className="tabular">{money(cart.subtotal)}</dd></div>
                  <div className="flex justify-between text-muted"><dt>Delivery</dt><dd className="tabular">{cart.delivery ? money(cart.delivery) : 'Free'}</dd></div>
                  <div className="flex justify-between pt-2 font-display text-lg font-semibold"><dt>Total</dt><dd className="tabular">{money(cart.total)}</dd></div>
                </dl>
                <Button size="lg" variant="ink" className="mt-5 w-full" onClick={() => { setOpen(false); navigate('/checkout') }}>
                  Checkout
                </Button>
                <p className="mt-3 text-center text-xs text-muted">Made to order in Bishkek · ships in 5–7 days</p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
