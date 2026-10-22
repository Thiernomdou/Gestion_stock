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
  const text = qtyFormatter.format(Number(value)).replace(/[  ]/g, ' ')
  return unit ? `${text} ${unit}` : text
}

/** « Quincaillerie du Port » → « quincaillerie-du-port » */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
