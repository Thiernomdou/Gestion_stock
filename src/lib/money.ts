// Montants : entiers dans la devise de l'organisation (CLAUDE.md §5.2).
// Seul point d'entrée pour afficher de l'argent : formatMoney.

const NBSP = ' '
const formatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true })

/** Convertit une valeur reçue (number, bigint, chaîne PostgREST) en entier. */
export function toMoney(value: number | bigint | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

/** 1250000 → « 1 250 000 GNF » (espaces insécables : le montant ne se coupe jamais). */
export function formatMoney(amount: number | bigint | string | null | undefined, currency = 'GNF'): string {
  // Intl utilise U+202F (espace fine) que les imprimantes thermiques n'affichent pas toujours.
  const digits = formatter.format(toMoney(amount)).replace(/[   ]/g, NBSP)
  return `${digits}${NBSP}${currency}`
}

/** Saisie utilisateur « 1 250 000 » ou « 1250000 » → 1250000 ; null si invalide. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isSafeInteger(n) ? n : null
}
