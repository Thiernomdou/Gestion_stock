import type { MemberRole } from './database.types'

// Reflet côté interface des droits SQL (CLAUDE.md §4). La sécurité réelle reste la RLS :
// ces règles servent uniquement à masquer ce qu'un rôle ne peut pas faire.
const MATRIX = {
  sell:               ['owner', 'manager', 'cashier'],
  collect_credit:     ['owner', 'manager', 'cashier'],
  record_expense:     ['owner', 'manager', 'cashier'],
  cancel_sale:        ['owner', 'manager'],
  view_costs:         ['owner', 'manager'],
  manage_products:    ['owner', 'manager'],
  manage_purchases:   ['owner', 'manager'],
  manage_stores:      ['owner', 'manager'],
  view_stock:         ['owner', 'manager', 'cashier', 'storekeeper'],
  adjust_stock:       ['owner', 'manager', 'storekeeper'],
  count_inventory:    ['owner', 'manager', 'storekeeper'],
  validate_inventory: ['owner', 'manager'],
  view_reports:       ['owner', 'manager'],
  manage_users:       ['owner'],
  manage_organization:['owner'],
  view_audit:         ['owner'],
} as const satisfies Record<string, readonly MemberRole[]>

export type Permission = keyof typeof MATRIX

export function can(role: MemberRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (MATRIX[permission] as readonly MemberRole[]).includes(role)
}
