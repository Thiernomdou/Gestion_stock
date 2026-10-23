import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import {
  ArrowRight, BarChart3, Boxes, Check, ClipboardList, FileClock, FolderTree, LayoutDashboard, type LucideIcon, PackageX,
  PackagePlus, Receipt, ScrollText, Settings, ShoppingCart, Ship, Tags, TriangleAlert, Truck, Upload, UserPlus, Users,
  Wallet,
} from 'lucide-react'
import { type CSSProperties, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrg } from '@/features/organization/context'
import { useCategories, useProductCosts, useProducts, useStock } from '@/features/products/api'
import { stockLevel } from '@/features/products/schema'
import { useMembers } from '@/features/settings/api'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { can, type Permission } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface Tile {
  label: string
  icon: LucideIcon
  permission: Permission[]   // il suffit d'une
  to?: string                // absent = module pas encore livré
}

// Ordre = feuille de route (CLAUDE.md §9). Renseigner `to` à la livraison de chaque module.
const m = fr.modules
const TILES: Tile[] = [
  { label: m.pos, icon: ShoppingCart, permission: ['sell'], to: '/caisse' },
  { label: m.cash, icon: Wallet, permission: ['sell'], to: '/caisse/journee' },
  { label: m.products, icon: Tags, permission: ['view_stock'], to: '/produits' },
  { label: m.settings, icon: Settings, permission: ['manage_stores', 'manage_users'], to: '/parametres' },
  { label: m.dashboard, icon: LayoutDashboard, permission: ['view_reports'] },
  { label: m.sales, icon: Receipt, permission: ['sell'] },
  { label: m.stock, icon: Boxes, permission: ['view_stock'] },
  { label: m.inventory, icon: ClipboardList, permission: ['count_inventory'] },
  { label: m.purchases, icon: Ship, permission: ['manage_purchases'] },
  { label: m.suppliers, icon: Truck, permission: ['manage_purchases'] },
  { label: m.customers, icon: Users, permission: ['collect_credit'] },
  { label: m.expenses, icon: FileClock, permission: ['record_expense'] },
  { label: m.reports, icon: BarChart3, permission: ['view_reports'] },
  { label: m.audit, icon: ScrollText, permission: ['view_audit'] },
]

const h = fr.home
const delay = (i: number) => ({ '--i': i }) as CSSProperties

/** Chiffres clés du catalogue pour la boutique en cours. */
function useCatalogStats() {
  const { org, role, store } = useCurrentOrg()
  const products = useProducts(org.id)
  const stock = useStock(org.id)
  const costs = useProductCosts(org.id, can(role, 'view_costs'))

  const stats = useMemo(() => {
    const active = (products.data ?? []).filter((p) => p.is_active)
    const byProduct = store ? stock.data?.get(store.id) : undefined
    let low = 0, out = 0, value = 0
    for (const p of active) {
      const q = byProduct?.get(p.id)
      const level = stockLevel(q, Number(p.min_stock))
      if (level === 'out') out++
      else if (level === 'low') low++
      if (q && q > 0) value += q * (costs.data?.get(p.id) ?? 0)
    }
    return { count: active.length, low, out, value: Math.round(value), hasStock: (byProduct?.size ?? 0) > 0 }
  }, [products.data, stock.data, costs.data, store])

  return { ...stats, pending: products.isPending || stock.isPending, error: products.error ?? stock.error, costs: costs.data }
}

function StatCard({ to, value, label, icon: Icon, tone, i }: {
  to: string; value: string | number; label: string; icon: LucideIcon; tone?: 'warning' | 'danger' | undefined; i: number
}) {
  return (
    <Link
      to={to}
      style={delay(i)}
      className="group flex stagger flex-col justify-between gap-3 rounded-3xl p-3.5 surface transition-transform active:scale-[0.98] sm:gap-4 sm:p-5"
    >
      <span
        className={cn(
          'grid size-10 place-items-center rounded-xl',
          tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'danger' ? 'bg-destructive-soft text-destructive' : 'bg-accent text-accent-foreground',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-[1.6rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-[1.85rem]">{value}</span>
        <span className="mt-1.5 flex items-center gap-1 text-[0.8rem] leading-tight font-semibold text-muted-foreground sm:text-sm">
          {label}
          <ArrowRight className="size-3.5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
        </span>
      </span>
    </Link>
  )
}

function CatalogStats() {
  const { org, role } = useCurrentOrg()
  const s = useCatalogStats()

  if (s.pending) {
    return <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}</div>
  }
  if (s.error) return null

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <StatCard i={0} to="/produits" icon={Tags} value={s.count} label={h.productsLabel(s.count)} />
      <StatCard i={1} to="/produits?filtre=bas" icon={TriangleAlert} value={s.low} label={h.lowStockLabel(s.low)} tone={s.low > 0 ? 'warning' : undefined} />
      <StatCard i={2} to="/produits?filtre=bas" icon={PackageX} value={s.out} label={h.outLabel(s.out)} tone={s.out > 0 ? 'danger' : undefined} />
      {can(role, 'view_costs') ? (
        <div style={delay(3)} className="col-span-3 flex stagger flex-col justify-between gap-4 rounded-3xl bg-linear-to-br from-ink to-ink-2 p-4 text-white shadow-primary sm:p-5 lg:col-span-1">
          <span className="grid size-10 place-items-center rounded-xl bg-white/12"><Wallet className="size-5" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block truncate text-[1.85rem] leading-none font-extrabold tracking-tight tabular-nums lg:text-2xl">
              {formatMoney(s.value, org.currency)}
            </span>
            <span className="mt-1.5 block text-sm font-semibold text-white/75">{h.stockValue}</span>
          </span>
        </div>
      ) : null}
    </div>
  )
}

interface SetupStep { done: boolean; label: string; hint: string; to: string; icon: LucideIcon }

/** Liste de démarrage d'un nouveau commerçant ; disparaît quand tout est fait. */
function SetupChecklist() {
  const { org, role } = useCurrentOrg()
  const categories = useCategories(org.id)
  const s = useCatalogStats()
  const canInvite = can(role, 'manage_users')
  const members = useMembers(org.id, canInvite)

  if (categories.isPending || s.pending || (canInvite && members.isPending)) return null

  const t = h.setup
  const steps: SetupStep[] = [
    { done: (categories.data?.length ?? 0) > 0, label: t.categories, hint: t.categoriesHint, to: '/produits/categories', icon: FolderTree },
    { done: s.count > 0, label: t.products, hint: t.productsHint, to: '/produits/import', icon: PackagePlus },
    { done: s.hasStock, label: t.stock, hint: t.stockHint, to: '/produits', icon: Boxes },
    ...(canInvite
      ? [{ done: (members.data?.length ?? 0) > 1, label: t.team, hint: t.teamHint, to: '/parametres?onglet=utilisateurs', icon: UserPlus }]
      : []),
  ]
  const done = steps.filter((x) => x.done).length
  if (done === steps.length) return null

  return (
    <section className="grid animate-rise grid-cols-1 gap-4 rounded-3xl p-4 surface sm:p-5" aria-labelledby="setup-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-lg font-bold tracking-tight">{t.title}</h2>
          <p className="text-sm font-medium text-muted-foreground">{t.progress(done, steps.length)}</p>
        </div>
        <div className="flex shrink-0 gap-1 pb-1.5" aria-hidden>
          {steps.map((x, i) => <span key={i} className={cn('h-2 w-5 rounded-full', x.done ? 'bg-primary' : 'bg-muted')} />)}
        </div>
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {steps.map(({ done: ok, label, hint, to, icon: Icon }) => (
          <li key={label}>
            <Link
              to={to}
              className={cn(
                'group flex items-center gap-3 rounded-2xl p-3 transition-colors',
                ok ? 'bg-muted/60' : 'bg-accent/60 hover:bg-accent',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', ok ? 'bg-success text-white' : 'bg-card text-primary shadow-card')}>
                {ok ? <Check className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-base leading-snug font-bold', ok && 'text-muted-foreground line-through decoration-2')}>{label}</span>
                <span className="block truncate text-sm text-muted-foreground">{hint}</span>
              </span>
              {!ok && <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function HomePage() {
  const { org, role, store } = useCurrentOrg()
  const [now] = useState(() => new TZDate(new Date(), org.timezone))
  const tiles = TILES.filter((t) => t.permission.some((p) => can(role, p)))
  const ready = tiles.filter((t) => t.to)
  const soon = tiles.filter((t) => !t.to)

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      {/* Bandeau du jour */}
      <section className="relative animate-rise overflow-hidden rounded-[2rem] bg-linear-to-br from-ink via-ink to-ink-2 px-5 pt-6 pb-6 text-white shadow-raised sm:px-8 sm:pt-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,oklch(0.7_0.12_180/0.45),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-[radial-gradient(circle,oklch(0.6_0.1_200/0.35),transparent_70%)]" />
        {/* Trame discrète de rayonnage */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/0.04)_1px,transparent_1px)] mask-[linear-gradient(to_left,black,transparent_70%)] bg-size-[28px_28px]" />

        <p className="relative inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-sm font-semibold capitalize ring-1 ring-white/15">
          {format(now, 'EEEE d MMMM', { locale: frLocale })}
        </p>
        <h1 className="relative mt-4 text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[2.6rem]">
          {h.greeting(now.getHours())}
        </h1>
        {store && <p className="relative mt-2 text-base text-white/75">{store.name} · {fr.roles[role]}</p>}

        {(can(role, 'sell') || can(role, 'manage_products')) && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            {can(role, 'sell') && (
              <Link to="/caisse" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-ink shadow-raised transition-transform active:scale-[0.98]">
                <ShoppingCart className="size-5 text-primary" aria-hidden /> {fr.pos.title}
              </Link>
            )}
            {can(role, 'manage_products') && (
              <Link to="/produits/nouveau" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/10 px-4 text-base font-semibold ring-1 ring-white/20 transition-colors hover:bg-white/15 active:scale-[0.98]">
                <PackagePlus className="size-5" aria-hidden /> {fr.products.new}
              </Link>
            )}
            {can(role, 'manage_products') && (
              <Link to="/produits/import" className="hidden h-12 items-center gap-2 rounded-2xl bg-white/10 px-4 text-base font-semibold ring-1 ring-white/20 transition-colors hover:bg-white/15 active:scale-[0.98] sm:inline-flex">
                <Upload className="size-5" aria-hidden /> {fr.products.import}
              </Link>
            )}
          </div>
        )}
      </section>

      {can(role, 'view_stock') && <CatalogStats />}

      {can(role, 'manage_products') && <SetupChecklist />}

      <section className="grid gap-3">
        <h2 className="text-lg font-bold tracking-tight">{h.modules}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ready.map(({ label, icon: Icon, to }, i) => (
            <li key={label} style={delay(i)} className="stagger">
              <Link to={to!} className="group flex h-full min-h-32 flex-col justify-between gap-4 rounded-3xl p-4 surface transition-[transform,box-shadow] hover:shadow-raised active:scale-[0.98]">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="flex items-center justify-between gap-2 text-base leading-tight font-bold">
                  {label}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {soon.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{fr.app.soon}</h2>
          <ul className="flex flex-wrap gap-2">
            {soon.map(({ label, icon: Icon }) => (
              <li key={label} className="flex h-10 items-center gap-2 rounded-xl bg-muted/70 px-3 text-sm font-medium text-muted-foreground">
                <Icon className="size-4" aria-hidden /> {label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
