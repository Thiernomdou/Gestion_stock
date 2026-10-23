import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'

export const DEFAULT_TIMEZONE = 'Africa/Conakry'

/** Date et heure dans le fuseau de l'organisation : « 22 oct. 2026 à 14:05 ». */
export function formatDateTime(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(new TZDate(new Date(value), timezone), "d MMM yyyy 'à' HH:mm", { locale: frLocale })
}

/** Date seule : « 22 oct. 2026 ». */
export function formatDate(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(new TZDate(new Date(value), timezone), 'd MMM yyyy', { locale: frLocale })
}

const qtyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

/** Quantité : 12.5 → « 12,5 » ; avec unité : « 12,5 mètre ». */
export function formatQty(value: number | string, unit?: string): string {
  const text = qtyFormatter.format(Number(value)).replace(/[\u202f ]/g, '\u00a0')
  return unit ? `${text}\u00a0${unit}` : text
}

/** Saisie « 12,5 » ou « 12.5 » → 12.5 ; null si vide ou invalide (3 décimales max). */
export function parseQuantity(input: string): number | null {
  const cleaned = input.replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,3})?$/.test(cleaned)) return null
  return Number(cleaned)
}

/** Initiales pour un avatar : « Quincaillerie du Port » → « QP ». */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z0-9]/.test(w))
  return (words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : name.slice(0, 2)).toUpperCase()
}

/** « Quincaillerie du Port » → « quincaillerie-du-port » */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Heure seule : « 14:05 ». */
export function formatTime(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(new TZDate(new Date(value), timezone), 'HH:mm', { locale: frLocale })
}
