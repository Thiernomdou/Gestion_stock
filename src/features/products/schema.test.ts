import { describe, expect, it } from 'vitest'
import { normalizeSearch, productSchema, stockLevel } from './schema'

const base = {
  name: 'Robinet', category_id: null, brand: '', sku: ' ROB-1 ', barcode: '', description: '',
  unit: 'pièce', allow_decimal_qty: false, sale_price: 185000, wholesale_price: null,
  min_stock: 3, is_active: true, opening_qty: null, opening_cost: null,
}

describe('productSchema', () => {
  it('nettoie les champs texte vides', () => {
    const r = productSchema.parse(base)
    expect(r).toMatchObject({ sku: 'ROB-1', brand: null, barcode: null })
  })
  it('exige un prix de vente entier', () => {
    expect(productSchema.safeParse({ ...base, sale_price: null }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, sale_price: 10.5 }).success).toBe(false)
  })
})

describe('stockLevel', () => {
  it('classe rupture / bas / ok', () => {
    expect(stockLevel(undefined, 0)).toBe('out')
    expect(stockLevel(0, 5)).toBe('out')
    expect(stockLevel(5, 5)).toBe('low')
    expect(stockLevel(6, 5)).toBe('ok')
    expect(stockLevel(1, 0)).toBe('ok')
  })
})

describe('normalizeSearch', () => {
  it('ignore accents et majuscules', () => {
    expect(normalizeSearch('  Câble Électrique ')).toBe('cable electrique')
  })
})
