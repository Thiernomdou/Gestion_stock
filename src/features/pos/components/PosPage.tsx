import { ChevronRight, PackageOpen, ShoppingBasket, Store as StoreIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/bottom-sheet'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrg } from '@/features/organization/context'
import { type Product, useCategories, useProducts, useStock } from '@/features/products/api'
import { errorMessage } from '@/lib/errors'
import { formatTime } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { can } from '@/lib/permissions'
import { useOpenSession } from '../api'
import { cartTotals, maxDiscount } from '../cart'
import type { ReceiptData } from '../receipt'
import { useCart, usePos } from '../store'
import { CartPanel } from './CartPanel'
import { Catalog } from './Catalog'
import { CheckoutSheet } from './CheckoutSheet'
import { OpenSessionCard } from './OpenSessionCard'
import { SaleDone } from './SaleDone'

const t = fr.pos

export function PosPage() {
  const { org, role, store } = useCurrentOrg()
  if (!can(role, 'sell')) return <Navigate to="/" replace />
  if (!store) return <EmptyState icon={StoreIcon} title={t.title} text={t.noStore} />
  return <Pos key={store.id} storeId={store.id} orgId={org.id} />
}

function Pos({ storeId, orgId }: { storeId: string; orgId: string }) {
  const { org, role, settings } = useCurrentOrg()
  const session = useOpenSession(storeId)
  const products = useProducts(orgId)
  const categories = useCategories(orgId)
  const stock = useStock(orgId)
  const cart = useCart(storeId)
  const add = usePos((s) => s.add)
  const clear = usePos((s) => s.clear)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [done, setDone] = useState<ReceiptData | null>(null)

  const isManager = can(role, 'view_costs')
  const canDiscount = isManager || settings.cashier_can_discount
  const totals = cartTotals(cart.lines, cart.globalDiscount)
  const discountMax = maxDiscount(totals.subtotal, isManager, settings)
  const active = useMemo(() => (products.data ?? []).filter((p) => p.is_active), [products.data])
  const productById = useMemo(() => new Map(active.map((p) => [p.id, p])), [active])
  const inCart = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of cart.lines) map.set(l.productId, (map.get(l.productId) ?? 0) + l.quantity)
    return map
  }, [cart.lines])
  const storeStock = stock.data?.get(storeId)
  // Stock affiché : stock serveur − quantités déjà dans le panier (CLAUDE.md §6).
  const available = (id: string) => {
    const q = storeStock?.get(id)
    const c = inCart.get(id) ?? 0
    return q === undefined && c === 0 ? undefined : (q ?? 0) - c
  }

  const onAdd = (p: Product) => {
    const step = 1
    const left = available(p.id) ?? 0
    if (!settings.allow_negative_stock && left < step) {
      toast.error(`${fr.products.stock.out} : ${p.name}`)
      return
    }
    add(storeId, p, step)
  }

  const checkout = () => { setCartOpen(false); setCheckoutOpen(true) }
  const finish = (receipt: ReceiptData) => { clear(storeId); setCheckoutOpen(false); setDone(receipt) }

  if (session.isPending || products.isPending || categories.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-13 rounded-2xl" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}</div>
      </div>
    )
  }
  const error = session.error ?? products.error ?? categories.error
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => { void session.refetch(); void products.refetch() }} retryLabel={fr.app.retry} />
  if (!session.data) return <OpenSessionCard storeId={storeId} />
  if (active.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title={fr.products.emptyTitle}
        text={t.noProducts}
        action={can(role, 'manage_products') && <Button asChild size="lg"><Link to="/produits/nouveau">{fr.products.new}</Link></Button>}
      />
    )
  }

  const m = (n: number) => formatMoney(n, org.currency)
  const panelProps = { cart, totals, storeId, currency: org.currency, productById, canDiscount, discountMax, onCheckout: checkout }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6">
      <div className="grid min-w-0 grid-cols-1 gap-3">
        <Link
          to="/caisse/journee"
          className="flex items-center gap-2 self-start justify-self-start rounded-full bg-success-soft py-1.5 pr-3 pl-2.5 text-sm font-semibold text-success transition-colors hover:bg-success/15"
        >
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          {t.openedBy(formatTime(session.data.opened_at, org.timezone))}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <Catalog
          products={active}
          categories={categories.data ?? []}
          currency={org.currency}
          available={available}
          inCart={(id) => inCart.get(id) ?? 0}
          onAdd={onAdd}
        />
      </div>

      {/* Grand écran : panier toujours visible à droite */}
      <aside className="sticky top-24 hidden max-h-[calc(100dvh-7.5rem)] flex-col rounded-[2rem] p-5 surface lg:flex" aria-label={t.cart}>
        <h2 className="mb-2 text-xl font-extrabold tracking-tight">{t.cart}</h2>
        <CartPanel {...panelProps} className="min-h-0 flex-1" />
      </aside>

      {/* Téléphone : barre du panier au-dessus de la navigation */}
      {cart.lines.length > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.1rem)] z-30 mx-auto flex max-w-md animate-rise items-center gap-3 rounded-[1.6rem] bg-primary bg-linear-to-b from-white/12 to-transparent p-2 pr-4 text-left text-primary-foreground shadow-primary ring-4 ring-background lg:hidden"
        >
          <span className="relative grid size-12 place-items-center rounded-2xl bg-white/15">
            <ShoppingBasket className="size-6" aria-hidden />
            <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs font-extrabold text-primary tabular-nums">
              {totals.items}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-white/75">{t.seeCart}</span>
            <span className="block truncate text-xl leading-tight font-extrabold tabular-nums">{m(totals.total)}</span>
          </span>
          <span className="text-base font-bold">{t.checkout}</span>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
      {/* Espace pour que la barre du panier ne cache pas les derniers produits */}
      {cart.lines.length > 0 && <div aria-hidden className="h-20 lg:hidden" />}

      <BottomSheet open={cartOpen} onOpenChange={setCartOpen} title={t.cart}>
        <CartPanel {...panelProps} />
      </BottomSheet>

      {checkoutOpen && (
        <CheckoutSheet open onOpenChange={setCheckoutOpen} cart={cart} totals={totals} session={session.data} onDone={finish} />
      )}
      {done && <SaleDone receipt={done} onNewSale={() => setDone(null)} />}
    </div>
  )
}
