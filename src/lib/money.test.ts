import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoney, toMoney } from './money'

const S = '\u00a0'

describe('formatMoney', () => {
  it('sépare les milliers par des espaces, sans décimales', () => {
    expect(formatMoney(1250000)).toBe(`1${S}250${S}000${S}GNF`)
  })
  it('arrondit à l’entier', () => {
    expect(formatMoney(999.6)).toBe(`1${S}000${S}GNF`)
  })
  it('accepte les chaînes, bigint et valeurs vides', () => {
    expect(formatMoney('45000')).toBe(`45${S}000${S}GNF`)
    expect(formatMoney(12n)).toBe(`12${S}GNF`)
    expect(formatMoney(null)).toBe(`0${S}GNF`)
  })
  it('affiche la devise de l’organisation', () => {
    expect(formatMoney(5000, 'XOF')).toBe(`5${S}000${S}XOF`)
  })
})

describe('parseMoney / toMoney', () => {
  it('lit une saisie avec espaces', () => {
    expect(parseMoney('1 250 000')).toBe(1250000)
    expect(parseMoney(' 300 ')).toBe(300)
  })
  it('refuse les décimales, signes et lettres', () => {
    expect(parseMoney('12,5')).toBeNull()
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
  })
  it('toMoney ignore les valeurs non numériques', () => {
    expect(toMoney('x')).toBe(0)
    expect(toMoney(10.4)).toBe(10)
  })
})
