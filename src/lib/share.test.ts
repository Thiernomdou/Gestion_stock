import { describe, expect, it } from 'vitest'
import { internationalPhone, paymentLabel, whatsappUrl } from './share'

describe('partage', () => {
  it('libellés des modes de paiement', () => {
    expect(paymentLabel('orange_money')).toBe('Orange Money')
    expect(paymentLabel('wave')).toBe('wave')
  })

  it('numéro guinéen local → international', () => {
    expect(internationalPhone('622 12 34 56', 'GN')).toBe('224622123456')
    expect(internationalPhone('+224 622 12 34 56', 'GN')).toBe('224622123456')
    expect(internationalPhone('00224622123456', 'GN')).toBe('224622123456')
    expect(internationalPhone('12', 'GN')).toBeNull()
    expect(internationalPhone(null, 'GN')).toBeNull()
  })

  it('lien WhatsApp avec ou sans destinataire', () => {
    expect(whatsappUrl('Merci', '622123456', 'GN')).toBe('https://wa.me/224622123456?text=Merci')
    expect(whatsappUrl('Total : 1 000 GNF')).toBe('https://wa.me/?text=Total%20%3A%201%20000%20GNF')
  })
})
