import { formatQty } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { cn } from '@/lib/utils'
import { stockLevel } from '../schema'

/** Stock d'un produit dans la boutique en cours : vert / orange (seuil) / rouge (rupture). */
export function StockBadge({ quantity, minStock, unit, className }: {
  quantity: number | undefined; minStock: number; unit: string; className?: string
}) {
  const level = stockLevel(quantity, minStock)
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold whitespace-nowrap tabular-nums',
        level === 'out' && 'bg-destructive-soft text-destructive',
        level === 'low' && 'bg-warning-soft text-warning',
        level === 'ok' && 'bg-success-soft text-success',
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {quantity === undefined ? fr.products.stock.none : formatQty(quantity, unit)}
      {level === 'out' && quantity !== undefined && <span className="sr-only">({fr.products.stock.out})</span>}
      {level === 'low' && <span className="sr-only">({fr.products.stock.low})</span>}
    </span>
  )
}
