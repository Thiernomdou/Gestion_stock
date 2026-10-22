import { House, type LucideIcon, Settings, Tags } from 'lucide-react'
import { fr } from '@/lib/i18n/fr'
import type { Permission } from '@/lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Il suffit d'une des permissions. Absent = visible par tous. */
  permission?: Permission[]
}

// Modules livrés uniquement. Ajouter ici chaque module à sa livraison (Caisse, Stock…).
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: fr.nav.home, icon: House },
  { to: '/produits', label: fr.nav.products, icon: Tags, permission: ['view_stock'] },
  { to: '/parametres', label: fr.nav.settings, icon: Settings, permission: ['manage_stores', 'manage_users'] },
]
