import { describe, expect, it } from 'vitest'
import { categoryHue } from './category-color'

describe('categoryHue', () => {
  it('est stable pour une même catégorie', () => {
    const id = '5b8f0c1e-3a2d-4c6b-9e7f-1a2b3c4d5e6f'
    expect(categoryHue(id)).toBe(categoryHue(id))
  })
  it('renvoie une teinte neutre sans catégorie', () => {
    expect(categoryHue(null)).toBe(220)
  })
  it('évite le rouge et l’ambre des alertes', () => {
    for (let i = 0; i < 200; i++) {
      const hue = categoryHue(crypto.randomUUID())
      expect(hue < 15 || hue > 75 || hue === 45).toBe(true)
    }
  })
})
