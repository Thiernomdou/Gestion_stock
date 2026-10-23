import { fr } from './i18n/fr'

/** Libellé d'un mode de paiement ; une clé ajoutée par un client s'affiche telle quelle. */
export function paymentLabel(method: string): string {
  return fr.paymentMethods[method] ?? method
}

// Indicatifs des pays visés (Afrique de l'Ouest). Pays absent : le numéro doit être saisi en international.
const DIAL_CODES: Record<string, { code: string; length: number }> = {
  GN: { code: '224', length: 9 },
  SN: { code: '221', length: 9 },
  CI: { code: '225', length: 10 },
  ML: { code: '223', length: 8 },
  BF: { code: '226', length: 8 },
  SL: { code: '232', length: 8 },
}

/** Numéro au format international sans « + » (attendu par wa.me), ou null s'il est inutilisable. */
export function internationalPhone(phone: string | null | undefined, country: string): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (phone.trim().startsWith('00')) digits = digits.slice(2)
  const dial = DIAL_CODES[country]
  if (dial && digits.length === dial.length) return dial.code + digits
  return digits.length >= 8 ? digits : null
}

/** Lien WhatsApp : vers le client si son numéro est connu, sinon choix du contact dans WhatsApp. */
export function whatsappUrl(text: string, phone?: string | null, country = 'GN'): string {
  const to = internationalPhone(phone, country)
  return `https://wa.me/${to ?? ''}?text=${encodeURIComponent(text)}`
}
