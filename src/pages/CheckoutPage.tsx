import { motion } from 'framer-motion'
import { Check, MapPin, Phone, ShieldCheck, Store, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { errorMessage } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Img } from '../components/ui/Img'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Page } from '../layout/AppShell'
import { cn } from '../lib/cn'
import { money } from '../lib/format'
import { useCart } from '../store/cart'
import { toast } from '../store/toast'

export default function CheckoutPage() {
  const { cart, load } = useCart()
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState<'COURIER' | 'PICKUP'>('COURIER')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('+996 ')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [load])

  const fee = delivery === 'PICKUP' || !cart ? 0 : cart.delivery
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.checkout({ address: delivery === 'PICKUP' ? 'Pickup · BrandMarket studio, Bishkek' : address, phone, deliveryType: delivery })
      await load()
      navigate('/orders', { state: { placed: true } })
    } catch (err) {
      toast(errorMessage(err, 'Could not place order'), { tone: 'error' })
      setBusy(false)
    }
  }

  if (cart && cart.items.length === 0)
    return (
      <Page className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <h1 className="text-3xl font-bold">Your bag is empty</h1>
          <Link to="/"><Button variant="ink" className="mt-6">Continue shopping</Button></Link>
        </div>
      </Page>
    )

  return (
    <Page>
      <PageHeader eyebrow="Secure checkout" title="Checkout" />
      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-bold">Delivery</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {([
                ['COURIER', Truck, 'Courier', cart && cart.delivery === 0 ? 'Free · 1–2 days' : `${money(cart?.delivery ?? 250)} · 1–2 days`],
                ['PICKUP', Store, 'Pickup', 'Free · Bishkek studio'],
              ] as const).map(([v, Icon, label, hint]) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setDelivery(v)}
                  className={cn('relative flex items-center gap-4 rounded-2xl border p-5 text-left transition-all', delivery === v ? 'border-ink bg-surface shadow-soft' : 'border-line-strong hover:border-fg/30')}
                >
                  <span className={cn('grid size-11 place-items-center rounded-xl transition-colors', delivery === v ? 'bg-gold text-black' : 'bg-surface-2 text-muted')}><Icon className="size-5" /></span>
                  <span>
                    <span className="block text-[15px] font-semibold">{label}</span>
                    <span className="text-[13px] text-muted">{hint}</span>
                  </span>
                  {delivery === v && <motion.span layoutId="dl-check" className="absolute right-4 top-4 grid size-5 place-items-center rounded-full bg-ink text-ink-fg"><Check className="size-3" strokeWidth={3} /></motion.span>}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Contact</h2>
            {delivery === 'COURIER' && <Input id="addr" label="Address" icon={<MapPin />} placeholder="Chuy Ave 120, apt 14, Bishkek" value={address} onChange={(e) => setAddress(e.target.value)} required />}
            <Input id="phone" label="Phone" icon={<Phone />} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={9} />
          </section>
          <section>
            <h2 className="text-xl font-bold">Payment</h2>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line-strong p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-muted"><ShieldCheck className="size-5" /></span>
              <div>
                <p className="text-[15px] font-semibold">Pay on delivery</p>
                <p className="text-[13px] text-muted">Cash or card when your order arrives. Online payment is coming soon.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-xl font-bold">Order summary</h2>
            <div className="mt-5 max-h-[320px] space-y-4 overflow-y-auto">
              {cart
                ? cart.items.map((it) => (
                    <div key={it.id} className="flex gap-3">
                      <div className="relative">
                        <Img src={it.product.images[0]} className="h-20 w-[60px] rounded-lg object-cover" />
                        <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-ink-fg">{it.quantity}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{it.product.brand.name}</p>
                        <p className="truncate text-[13px] text-fg-2">{it.product.name}</p>
                        {it.size && <p className="text-xs text-muted">Size {it.size}</p>}
                      </div>
                      <p className="text-[13px] font-semibold tabular">{money(it.lineTotal)}</p>
                    </div>
                  ))
                : [0, 1].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-[14px]">
              <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd className="tabular">{money(cart?.subtotal ?? 0)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Delivery</dt><dd className="tabular">{fee ? money(fee) : 'Free'}</dd></div>
              <div className="flex justify-between pt-2 font-display text-xl font-semibold"><dt>Total</dt><dd className="tabular">{money((cart?.subtotal ?? 0) + fee)}</dd></div>
            </dl>
            <Button type="submit" size="lg" variant="ink" className="mt-6 w-full" loading={busy} disabled={!cart}>Place order</Button>
            <p className="mt-3 text-center text-xs text-muted">Your order goes straight to the factory floor.</p>
          </div>
        </aside>
      </form>
    </Page>
  )
}
