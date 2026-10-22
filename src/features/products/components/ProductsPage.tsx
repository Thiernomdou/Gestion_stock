import { Download, FolderTree, MoreHorizontal, PackageOpen, PackagePlus, PackageX, SearchX, TriangleAlert, Upload } from 'lucide-react'
import { type CSSProperties, useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrg } from '@/features/organization/context'
import { hueStyle } from '@/lib/category-color'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { type Product, useCategories, useProducts, useStock } from '../api'
import { toCsv } from '../csv'
import { normalizeSearch, stockLevel } from '../schema'
import { ProductThumb } from './ProductThumb'
import { StockBadge } from './StockBadge'

const PAGE = 60
const t = fr.products

type Filter = { kind: 'all' } | { kind: 'category'; id: string | null } | { kind: 'low' } | { kind: 'inactive' }

function readFilter(params: URLSearchParams): Filter {
  const f = params.get('filtre')
  if (f === 'bas') return { kind: 'low' }
  if (f === 'desactives') return { kind: 'inactive' }
  if (f === 'sans-categorie') return { kind: 'category', id: null }
  const cat = params.get('categorie')
  return cat ? { kind: 'category', id: cat } : { kind: 'all' }
}

function Chip({ active, onClick, children, tone, hue }: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'warning'; hue?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={hue}
      className={cn(
        'flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold whitespace-nowrap transition-colors',
        active
          ? tone === 'warning' ? 'bg-warning text-white shadow-card' : 'bg-foreground text-background shadow-card'
          : 'surface text-foreground hover:bg-muted',
      )}
    >
      {hue && <span aria-hidden className={cn('size-2.5 rounded-full tint-solid', active && 'ring-2 ring-background')} />}
      {children}
    </button>
  )
}

export function ProductsPage() {
  const { org, role, store } = useCurrentOrg()
  const products = useProducts(org.id)
  const categories = useCategories(org.id)
  const stock = useStock(org.id)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const deferredQuery = useDeferredValue(query)
  const filter = readFilter(params)
  const filterKind = filter.kind
  const filterCategory = filter.kind === 'category' ? filter.id : undefined
  const canEdit = can(role, 'manage_products')

  const storeStock = store ? stock.data?.get(store.id) : undefined
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data])

  // Index de recherche calculé une fois par chargement du catalogue.
  const indexed = useMemo(
    () => (products.data ?? []).map((p) => ({
      product: p,
      haystack: normalizeSearch([p.name, p.sku, p.barcode, p.brand].filter(Boolean).join(' ')),
    })),
    [products.data],
  )

  const filtered = useMemo(() => {
    const terms = normalizeSearch(deferredQuery).split(/\s+/).filter(Boolean)
    return indexed
      .filter(({ product: p, haystack }) => {
        if (filterKind === 'inactive' ? p.is_active : !p.is_active) return false
        if (filterKind === 'category' && p.category_id !== filterCategory) return false
        if (filterKind === 'low' && stockLevel(storeStock?.get(p.id), Number(p.min_stock)) === 'ok') return false
        return terms.every((term) => haystack.includes(term))
      })
      .map(({ product }) => product)
  }, [indexed, deferredQuery, filterKind, filterCategory, storeStock])

  // Résumé du stock de la boutique en cours (produits actifs).
  const alerts = useMemo(() => {
    let low = 0, out = 0
    for (const p of products.data ?? []) {
      if (!p.is_active) continue
      const level = stockLevel(storeStock?.get(p.id), Number(p.min_stock))
      if (level === 'low') low++
      else if (level === 'out') out++
    }
    return { low, out }
  }, [products.data, storeStock])

  const setFilter = (next: Filter) => {
    setLimit(PAGE)
    const p = new URLSearchParams()
    if (next.kind === 'low') p.set('filtre', 'bas')
    if (next.kind === 'inactive') p.set('filtre', 'desactives')
    if (next.kind === 'category') {
      if (next.id) p.set('categorie', next.id)
      else p.set('filtre', 'sans-categorie')
    }
    setParams(p, { replace: true })
  }

  const exportCsv = (list: Product[]) => {
    const csv = toCsv([
      ['Nom', 'Référence', 'Code-barres', 'Catégorie', 'Marque', 'Unité', `Prix de vente (${org.currency})`,
        `Prix de gros (${org.currency})`, "Seuil d'alerte", store ? `Stock ${store.name}` : 'Stock', 'Actif'],
      ...list.map((p) => [
        p.name, p.sku, p.barcode, p.category_id ? categoryName.get(p.category_id) : '', p.brand, p.unit,
        p.sale_price, p.wholesale_price, p.min_stock, storeStock?.get(p.id) ?? 0, p.is_active ? 'oui' : 'non',
      ]),
    ])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `produits-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = (products.data ?? []).filter((p) => p.is_active).length
  const loading = products.isPending || categories.isPending || stock.isPending
  const error = products.error ?? categories.error ?? stock.error

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title={t.title}
        description={products.data && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t.count(total)}</span>
            {alerts.low > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-warning">
                <TriangleAlert className="size-4" aria-hidden /> {t.summary.low(alerts.low)}
              </span>
            )}
            {alerts.out > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                <PackageX className="size-4" aria-hidden /> {t.summary.out(alerts.out)}
              </span>
            )}
          </span>
        )}
        actions={canEdit && (
          <>
            <Button asChild size="lg" className="hidden sm:inline-flex">
              <Link to="/produits/nouveau"><PackagePlus /> {t.new}</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-lg" aria-label={t.more} className="rounded-2xl border-transparent surface"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem asChild>
                  <Link to="/produits/import"><Upload className="size-5" /> {t.import}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!products.data} onSelect={() => exportCsv(filtered)}>
                  <Download className="size-5" /> {t.export}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/produits/categories"><FolderTree className="size-5" /> {t.categories}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      />

      <div className="sticky top-16 z-20 -mx-4 grid gap-3 bg-background/95 px-4 pt-2 pb-3">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setLimit(PAGE) }} placeholder={t.search} clearLabel={t.clearSearch} />
        <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1.5">
          <Chip active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>{t.all}</Chip>
          <Chip active={filter.kind === 'low'} onClick={() => setFilter({ kind: 'low' })} tone="warning">{t.lowStock}</Chip>
          {categories.data?.map((c) => (
            <Chip key={c.id} hue={hueStyle(c.id)} active={filter.kind === 'category' && filter.id === c.id} onClick={() => setFilter({ kind: 'category', id: c.id })}>
              {c.name}
            </Chip>
          ))}
          {(categories.data?.length ?? 0) > 0 && (
            <Chip active={filter.kind === 'category' && filter.id === null} onClick={() => setFilter({ kind: 'category', id: null })}>
              {t.noCategory}
            </Chip>
          )}
          {canEdit && <Chip active={filter.kind === 'inactive'} onClick={() => setFilter({ kind: 'inactive' })}>{t.inactive}</Chip>}
        </div>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => { void products.refetch(); void stock.refetch(); void categories.refetch() }} retryLabel={fr.app.retry} />
      ) : loading ? (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" aria-busy>
          {Array.from({ length: 6 }, (_, i) => <li key={i}><Skeleton className="h-[4.75rem] rounded-3xl" /></li>)}
        </ul>
      ) : total === 0 && filter.kind !== 'inactive' ? (
        <EmptyState
          icon={PackageOpen}
          title={t.emptyTitle}
          text={t.emptyText}
          action={canEdit && (
            <>
              <Button asChild size="lg"><Link to="/produits/nouveau"><PackagePlus /> {t.new}</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/produits/import"><Upload /> {t.import}</Link></Button>
            </>
          )}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={t.noResultTitle} text={t.noResultText} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {filtered.slice(0, limit).map((p, i) => (
              <li key={p.id} style={{ '--i': i } as CSSProperties} className="stagger">
                <Link
                  to={`/produits/${p.id}`}
                  className="flex items-center gap-3 rounded-3xl p-2.5 pr-3.5 surface transition-[transform,box-shadow] hover:shadow-raised active:scale-[0.99]"
                >
                  <ProductThumb name={p.name} photo={p.photo_url} categoryId={p.category_id} className="size-13 sm:size-14" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-base leading-snug font-bold">{p.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[p.category_id && categoryName.get(p.category_id), p.brand, p.sku].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-base font-extrabold tracking-tight tabular-nums">{formatMoney(p.sale_price, org.currency)}</span>
                    <StockBadge quantity={storeStock?.get(p.id)} minStock={Number(p.min_stock)} unit={p.unit} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {filtered.length > limit && (
            <Button variant="outline" size="lg" onClick={() => setLimit((l) => l + PAGE)}>
              {t.showMore(Math.min(PAGE, filtered.length - limit))}
            </Button>
          )}
        </>
      )}

      {canEdit && (
        <Link
          to="/produits/nouveau"
          aria-label={t.new}
          className="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.25rem)] z-30 grid size-16 place-items-center rounded-[1.4rem] bg-primary bg-linear-to-b from-white/15 to-transparent text-primary-foreground shadow-primary ring-4 ring-background active:scale-95 sm:hidden"
        >
          <PackagePlus className="size-7" />
        </Link>
      )}
    </div>
  )
}
