import {
  BarChart3, Boxes, ClipboardList, FileClock, LayoutDashboard, type LucideIcon, Receipt, ScrollText,
  Settings, ShoppingCart, Ship, Tags, Truck, Users, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/store'
import { useCurrentOrg } from '@/features/organization/context'
import { fr } from '@/lib/i18n/fr'
import { can, type Permission } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface Tile {
  label: string
  icon: LucideIcon
  permission: Permission | Permission[]   // plusieurs : il suffit d'en avoir une
  to?: string                             // absent = module pas encore livré
}

// Ordre = feuille de route (CLAUDE.md §9). Renseigner `to` à la livraison de chaque module.
const m = fr.modules
const TILES: Tile[] = [
  { label: m.pos, icon: ShoppingCart, permission: 'sell' },
  { label: m.dashboard, icon: LayoutDashboard, permission: 'view_reports' },
  { label: m.cash, icon: Wallet, permission: 'sell' },
  { label: m.sales, icon: Receipt, permission: 'sell' },
  { label: m.products, icon: Tags, permission: 'view_stock' },
  { label: m.stock, icon: Boxes, permission: 'view_stock' },
  { label: m.inventory, icon: ClipboardList, permission: 'count_inventory' },
  { label: m.purchases, icon: Ship, permission: 'manage_purchases' },
  { label: m.suppliers, icon: Truck, permission: 'manage_purchases' },
  { label: m.customers, icon: Users, permission: 'collect_credit' },
  { label: m.expenses, icon: FileClock, permission: 'record_expense' },
  { label: m.reports, icon: BarChart3, permission: 'view_reports' },
  { label: m.audit, icon: ScrollText, permission: 'view_audit' },
  { label: m.settings, icon: Settings, permission: ['manage_stores', 'manage_users'], to: '/parametres' },
]

export function HomePage() {
  const { role } = useCurrentOrg()
  const email = useAuth((s) => s.session?.user.email)
  const tiles = TILES.filter((tile) => [tile.permission].flat().some((p) => can(role, p)))

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">{fr.home.hello} {email}</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(({ label, icon: Icon, to }) => {
          const content = (
            <>
              <Icon className="size-9" aria-hidden />
              <span className="text-base font-semibold leading-tight">{label}</span>
              {!to && <Badge variant="secondary">{fr.app.soon}</Badge>}
            </>
          )
          const className = cn(
            'flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center',
            to ? 'bg-card text-primary shadow-sm active:bg-muted' : 'text-muted-foreground opacity-70',
          )
          return (
            <li key={label}>
              {to ? <Link to={to} className={className}>{content}</Link> : <div className={className} aria-disabled>{content}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
