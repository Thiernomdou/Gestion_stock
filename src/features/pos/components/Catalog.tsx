import { ScanBarcode, SearchX, X } from 'lucide-react'
import { type CSSProperties, useDeferredValue, useMemo, useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { Input } from '@/components/ui/input'
import type { Category, Product } from '@/features/products/api'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { normalizeSearch } from '@/features/products/schema'
import { hueStyle } from '@/lib/category-color'
import { formatQty } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const t = fr.pos
const LIMIT = 120

/** Catalogue de la caisse : recherche (ou lecteur de code-barres), rayons, tuiles produits. */
export function Catalog({ products, categories, currency, available, inCart, onAdd }: {
  products: Product[]
  categories: Category[]
  currency: string
  /** Stock disponible dans la boutique, panier déduit. */
  available: (productId: string) => number | undefined
  inCart: (productId: string) => number
  onAdd: (product: Product) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const deferred = useDeferredValue(query)

  const indexed = useMemo(
    () => products.map((p) => ({ p, haystack: normalizeSearch([p.name, p.sku, p.barcode, p.brand].filter(Boolean).join(' ')) })),
    [products],
  )
  const visible = useMemo(() => {
    const terms = normalizeSearch(deferred).split(/\s+/).filter(Boolean)
    return indexed
      .filter(({ p, haystack }) => (!category || p.category_id === category) && terms.every((x) => haystack.includes(x)))
      .map(({ p }) => p)
  }, [indexed, deferred, category])

  // Lecteur de code-barres USB/Bluetooth : il « tape » le code puis Entrée.
  const onEnter = () => {
    const code = query.trim()
    if (!code) return
    const exact = products.find((p) => p.barcode === code || p.sku?.toLowerCase() === code.toLowerCase())
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined)
    if (target) {
      onAdd(target)
      setQuery('')
    }
  }

  return (
    <section className="grid min-w-0 grid-cols-1 content-start gap-3">
      <div className="sticky top-16 z-20 -mx-4 grid gap-3 bg-background/95 px-4 pt-2 pb-2.5">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } }}
            placeholder={t.search}
            aria-label={t.search}
            className="h-13 rounded-2xl border-transparent pr-12 pl-12 text-base surface focus-visible:border-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={fr.products.clearSearch}
                    className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <X className="size-5" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => setCategory(null)}
              className={cn('h-11 shrink-0 rounded-2xl px-4 text-sm font-semibold transition-colors', category === null ? 'bg-foreground text-background' : 'surface hover:bg-muted')}
            >
              {t.all}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                style={hueStyle(c.id)}
                className={cn(
                  'flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  category === c.id ? 'tint-solid text-white' : 'surface hover:bg-muted',
                )}
              >
                {category !== c.id && <span aria-hidden className="size-2.5 rounded-full tint-solid" />}
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title={t.noProductTitle} text={t.noProductText} />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {visible.slice(0, LIMIT).map((p, i) => {
            const qty = available(p.id)
            const count = inCart(p.id)
            const out = qty !== undefined && qty <= 0
            return (
              <li key={p.id} style={{ '--i': i } as CSSProperties} className="stagger">
                <button
                  type="button"
                  onClick={() => onAdd(p)}
                  className={cn(
                    'relative flex h-full w-full flex-col gap-2.5 rounded-3xl p-3 text-left surface transition-[transform,box-shadow] hover:shadow-raised active:scale-[0.97]',
                    count > 0 && 'ring-2 ring-primary',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <ProductThumb name={p.name} photo={p.photo_url} categoryId={p.category_id} className="size-12 rounded-xl text-sm" />
                    {count > 0 && (
                      <span key={count} className="grid h-7 min-w-7 animate-rise place-items-center rounded-full bg-primary px-2 text-sm font-extrabold text-primary-foreground tabular-nums">
                        {formatQty(count)}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 min-h-[2.5rem] text-[0.95rem] leading-tight font-bold">{p.name}</span>
                  <span className="mt-auto flex items-end justify-between gap-1">
                    <span className="text-base leading-none font-extrabold tracking-tight tabular-nums">{formatMoney(p.sale_price, currency)}</span>
                  </span>
                  <span className={cn('text-xs font-semibold', out ? 'text-destructive' : 'text-muted-foreground')}>
                    {out ? t.outOfStock : qty === undefined ? fr.products.stock.none : t.inStock(formatQty(qty, p.unit))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
