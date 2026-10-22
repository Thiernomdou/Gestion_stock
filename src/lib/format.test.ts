import { describe, expect, it } from 'vitest'
import { formatDateTime, formatQty, slugify } from './format'

describe('format', () => {
  it('affiche la date dans le fuseau de l’organisation', () => {
    expect(formatDateTime('2026-10-22T23:30:00Z', 'Africa/Conakry')).toBe('22 oct. 2026 à 23:30')
    expect(formatDateTime('2026-10-22T23:30:00Z', 'Africa/Lagos')).toBe('23 oct. 2026 à 00:30')
  })
  it('affiche les quantités décimales à la française', () => {
    expect(formatQty(12.5)).toBe('12,5')
    expect(formatQty('3.000', 'mètre')).toBe('3 mètre')
  })
  it('génère un identifiant d’URL', () => {
    expect(slugify('Quincaillerie Électro du Port !')).toBe('quincaillerie-electro-du-port')
  })
})
