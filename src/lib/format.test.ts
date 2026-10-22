import { describe, expect, it } from 'vitest'
import { formatDateTime, formatQty, initials, parseQuantity, slugify } from './format'

describe('format', () => {
  it('affiche la date dans le fuseau de l’organisation', () => {
    expect(formatDateTime('2026-10-22T23:30:00Z', 'Africa/Conakry')).toBe('22 oct. 2026 à 23:30')
    expect(formatDateTime('2026-10-22T23:30:00Z', 'Africa/Lagos')).toBe('23 oct. 2026 à 00:30')
  })
  it('affiche les quantités décimales à la française', () => {
    expect(formatQty(12.5)).toBe('12,5')
    expect(formatQty('3.000', 'mètre')).toBe('3\u00a0mètre')
  })
  it('lit une quantité décimale à la française', () => {
    expect(parseQuantity('12,5')).toBe(12.5)
    expect(parseQuantity(' 1 000 ')).toBe(1000)
    expect(parseQuantity('0.125')).toBe(0.125)
    expect(parseQuantity('1,2345')).toBeNull()
    expect(parseQuantity('-3')).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
  it('calcule des initiales', () => {
    expect(initials('Quincaillerie du Port')).toBe('QP')
    expect(initials('Diallo')).toBe('DI')
  })
  it('génère un identifiant d’URL', () => {
    expect(slugify('Quincaillerie Électro du Port !')).toBe('quincaillerie-electro-du-port')
  })
})
