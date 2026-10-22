import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can', () => {
  it('le vendeur ne voit jamais les coûts', () => {
    expect(can('cashier', 'view_costs')).toBe(false)
    expect(can('cashier', 'sell')).toBe(true)
  })
  it('seul le patron gère les utilisateurs', () => {
    expect(can('owner', 'manage_users')).toBe(true)
    expect(can('manager', 'manage_users')).toBe(false)
  })
  it('le magasinier compte mais ne valide pas l’inventaire', () => {
    expect(can('storekeeper', 'count_inventory')).toBe(true)
    expect(can('storekeeper', 'validate_inventory')).toBe(false)
    expect(can('storekeeper', 'sell')).toBe(false)
  })
  it('sans rôle, aucun droit', () => {
    expect(can(null, 'view_stock')).toBe(false)
  })
})
