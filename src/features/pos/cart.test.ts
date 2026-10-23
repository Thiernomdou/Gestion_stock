import { describe, expect, it } from 'vitest'
import { type CartLine, cartTotals, cashSuggestions, lineGross, maxDiscount, normalizeQty, paymentsToRecord, summarizePayments } from './cart'

const line = (o: Partial<CartLine> = {}): CartLine => ({
  id: 'l', productId: 'p', name: 'Câble', unit: 'mètre', decimal: true,
  quantity: 1, priceMode: 'retail', unitPrice: 1000, discount: 0, ...o,
})

describe('panier', () => {
  it('arrondit le montant d’une ligne à l’entier (câble au mètre)', () => {
    expect(lineGross({ quantity: 12.5, unitPrice: 4500 })).toBe(56250)
    expect(lineGross({ quantity: 0.333, unitPrice: 1000 })).toBe(333)
  })

  it('calcule sous-total, remises et total', () => {
    const t = cartTotals([line({ quantity: 2, unitPrice: 10000, discount: 1000 }), line({ quantity: 12.5, unitPrice: 4500 })], 250)
    expect(t).toEqual({ subtotal: 76250, discount: 1250, total: 75000, items: 2 })
  })

  it('limite la remise d’un vendeur selon les paramètres', () => {
    expect(maxDiscount(100000, true, { cashier_can_discount: false, max_discount_percent: 0 })).toBe(100000)
    expect(maxDiscount(100000, false, { cashier_can_discount: false, max_discount_percent: 10 })).toBe(0)
    expect(maxDiscount(99999, false, { cashier_can_discount: true, max_discount_percent: 10 })).toBe(9999)
  })

  it('normalise les quantités', () => {
    expect(normalizeQty(12.5, true)).toBe(12.5)
    expect(normalizeQty(1.23456, true)).toBe(1.235)
    expect(normalizeQty(2.6, false)).toBe(3)
    expect(normalizeQty(-1, true)).toBe(0)
  })
})

describe('paiements', () => {
  it('rend la monnaie sur les espèces', () => {
    expect(summarizePayments(75000, [{ method: 'cash', amount: 100000 }])).toEqual({ paid: 75000, remaining: 0, change: 25000 })
    expect(paymentsToRecord(75000, [{ method: 'cash', amount: 100000 }])).toEqual([{ method: 'cash', amount: 75000 }])
  })

  it('paiement mixte espèces + Orange Money', () => {
    const p = [{ method: 'orange_money', amount: 50000 }, { method: 'cash', amount: 30000 }]
    expect(summarizePayments(75000, p)).toEqual({ paid: 75000, remaining: 0, change: 5000 })
    expect(paymentsToRecord(75000, p)).toEqual([{ method: 'cash', amount: 25000 }, { method: 'orange_money', amount: 50000 }])
  })

  it('le reste passe en crédit', () => {
    expect(summarizePayments(75000, [{ method: 'cash', amount: 20000 }])).toEqual({ paid: 20000, remaining: 55000, change: 0 })
    expect(summarizePayments(75000, [])).toEqual({ paid: 0, remaining: 75000, change: 0 })
    expect(paymentsToRecord(75000, [])).toEqual([])
  })
})

describe('billets proposés', () => {
  it('propose des montants ronds au-dessus du total', () => {
    expect(cashSuggestions(75000)).toEqual([76000, 80000, 100000])
    expect(cashSuggestions(4500)).toEqual([5000, 6000, 10000])
    expect(cashSuggestions(0)).toEqual([])
  })
})
