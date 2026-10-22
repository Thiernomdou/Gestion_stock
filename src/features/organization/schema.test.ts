import { describe, expect, it } from 'vitest'
import { parseSettings } from './schema'

describe('parseSettings', () => {
  it('complète les clés absentes avec des valeurs par défaut', () => {
    const s = parseSettings({ payment_methods: ['cash', 'orange_money'] })
    expect(s.payment_methods).toEqual(['cash', 'orange_money'])
    expect(s.allow_negative_stock).toBe(true)
    expect(s.receipt.width_mm).toBe(80)
  })
  it('ne plante pas sur un contenu invalide', () => {
    expect(parseSettings('n’importe quoi').cashier_can_discount).toBe(false)
    expect(parseSettings(null).units).toEqual(['pièce'])
  })
})
