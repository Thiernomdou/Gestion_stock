import { Minus, Percent, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MoneyInput, QuantityInput } from '@/components/amount-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { Product } from '@/features/products/api'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { type CartLine, type CartTotals, lineGross, lineTotal } from '../cart'
import type { Cart } from '../store'
import { usePos } from '../store'

const t = fr.pos

function LineRow({ line, product, storeId, currency, canDiscount }: {
  line: CartLine; product: Product | undefined; storeId: string; currency: string; canDiscount: boolean
}) {
  const { setQuantity, setPriceMode, setLineDiscount, remove } = usePos()
  const [showDiscount, setShowDiscount] = useState(line.discount > 0)
  const m = (n: number) => formatMoney(n, currency)
  const step = 1

  return (
    <li className="grid gap-2.5 py-3.5 first:pt-1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-bold">{line.name}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{m(line.unitPrice)} / {line.unit}</p>
        </div>
        <p className="text-base font-extrabold tracking-tight tabular-nums">{m(lineTotal(line))}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Quantité : gros boutons − / + et saisie directe (12,5 m) */}
        <div className="flex items-center rounded-2xl bg-muted p-1">
          <button
            type="button"
            aria-label={`− ${line.name}`}
            onClick={() => (line.quantity - step <= 0 ? remove(storeId, line.id) : setQuantity(storeId, line.id, line.quantity - step))}
            className="grid size-10 place-items-center rounded-xl bg-card shadow-card active:scale-95"
          >
            {line.quantity - step <= 0 ? <Trash2 className="size-4 text-destructive" /> : <Minus className="size-4" />}
          </button>
          <QuantityInput
            value={line.quantity}
            onChange={(v) => v !== null && v > 0 && setQuantity(storeId, line.id, v)}
            decimal={line.decimal}
            aria-label={`${t.quantity} ${line.name}`}
            className="h-10 w-20 border-transparent bg-transparent px-1 text-center text-lg shadow-none"
          />
          <button
            type="button"
            aria-label={`+ ${line.name}`}
            onClick={() => setQuantity(storeId, line.id, line.quantity + step)}
            className="grid size-10 place-items-center rounded-xl bg-card shadow-card active:scale-95"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {product?.wholesale_price != null && (
          <div className="flex rounded-2xl bg-muted p-1" role="group" aria-label={line.name}>
            {(['retail', 'wholesale'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={line.priceMode === mode}
                onClick={() => setPriceMode(storeId, line.id, mode, product)}
                className={cn('h-10 rounded-xl px-3 text-sm font-semibold transition-colors', line.priceMode === mode ? 'bg-card shadow-card' : 'text-muted-foreground')}
              >
                {mode === 'retail' ? t.retail : t.wholesale}
              </button>
            ))}
          </div>
        )}

        {canDiscount && !showDiscount && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`${t.discount} ${line.name}`} onClick={() => setShowDiscount(true)} className="ml-auto">
            <Percent />
          </Button>
        )}
      </div>

      {canDiscount && showDiscount && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">{t.discount}</span>
          <MoneyInput
            value={line.discount || null}
            onChange={(v) => setLineDiscount(storeId, line.id, Math.min(v ?? 0, lineGross(line)))}
            suffix={currency}
            aria-label={`${t.discount} ${line.name}`}
            className="h-10 text-base"
          />
        </div>
      )}
    </li>
  )
}

/** Panier : lignes, remises, total et bouton Encaisser. */
export function CartPanel({ cart, totals, storeId, currency, productById, canDiscount, discountMax, onCheckout, className }: {
  cart: Cart
  totals: CartTotals
  storeId: string
  currency: string
  productById: Map<string, Product>
  canDiscount: boolean
  discountMax: number
  onCheckout: () => void
  className?: string
}) {
  const { clear, setGlobalDiscount } = usePos()
  const m = (n: number) => formatMoney(n, currency)

  if (cart.lines.length === 0) {
    return (
      <div className={cn('grid place-items-center gap-2 px-4 py-10 text-center', className)}>
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><ShoppingBasket className="size-7" aria-hidden /></span>
        <p className="text-lg font-bold">{t.emptyCart}</p>
        <p className="text-sm text-muted-foreground">{t.emptyCartText}</p>
      </div>
    )
  }

  const overMax = totals.discount > discountMax

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="text-sm font-semibold text-muted-foreground">{t.items(totals.items)}</p>
        <ConfirmDialog
          trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> {t.clear}</Button>}
          title={t.clear}
          description={t.clearConfirm}
          confirmLabel={t.clear}
          destructive
          onConfirm={() => clear(storeId)}
        />
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {cart.lines.map((l) => (
          <LineRow key={l.id} line={l} product={productById.get(l.productId)} storeId={storeId} currency={currency} canDiscount={canDiscount} />
        ))}
      </ul>

      <div className="grid gap-2 border-t pt-3">
        {canDiscount && (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-semibold text-muted-foreground">{t.globalDiscount}</span>
            <MoneyInput
              value={cart.globalDiscount || null}
              onChange={(v) => setGlobalDiscount(storeId, v ?? 0)}
              suffix={currency}
              aria-label={t.globalDiscount}
              className="h-10 w-40 text-base"
            />
          </div>
        )}
        {totals.discount > 0 && (
          <>
            <div className="flex justify-between text-sm text-muted-foreground"><span>{t.subtotal}</span><span className="tabular-nums">{m(totals.subtotal)}</span></div>
            <div className={cn('flex justify-between text-sm', overMax ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              <span>{t.discount}</span><span className="tabular-nums">−{m(totals.discount)}</span>
            </div>
            {overMax && <p role="alert" className="text-sm font-semibold text-destructive">{t.maxDiscount(m(discountMax))}</p>}
          </>
        )}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold">{t.total}</span>
          <span className="text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums">{m(totals.total)}</span>
        </div>
        <Button size="lg" className="mt-1 w-full" onClick={onCheckout} disabled={overMax || totals.total < 0}>
          {t.checkout} · {m(totals.total)}
        </Button>
      </div>
    </div>
  )
}
