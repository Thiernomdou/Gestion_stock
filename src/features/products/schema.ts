import { z } from 'zod'
import { fr } from '@/lib/i18n/fr'

const optionalText = (max = 120) =>
  z.string().trim().max(max).transform((v) => (v === '' ? null : v))

const money = z.number().int().min(0)
const quantity = z.number().min(0).max(1e9)

export const productSchema = z.object({
  name: z.string().trim().min(2, fr.errors.required).max(160),
  category_id: z.string().nullable(),
  brand: optionalText(),
  sku: optionalText(60),
  barcode: optionalText(60),
  description: optionalText(1000),
  unit: z.string().min(1, fr.errors.required),
  allow_decimal_qty: z.boolean(),
  sale_price: money.nullable().refine((v) => v !== null, fr.errors.required),
  wholesale_price: money.nullable(),
  min_stock: quantity.nullable(),
  is_active: z.boolean(),
  // Stock d'ouverture (création, gérant uniquement)
  opening_qty: quantity.nullable(),
  opening_cost: z.number().min(0).nullable(),
})

export type ProductFormInput = z.input<typeof productSchema>
export type ProductFormValues = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(1, fr.errors.required).max(60),
})
export type CategoryInput = z.infer<typeof categorySchema>

/** Statut de stock d'un produit pour l'affichage (couleur du badge, filtre « stock bas »). */
export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(quantity: number | undefined, minStock: number): StockLevel {
  const q = quantity ?? 0
  if (q <= 0) return 'out'
  if (minStock > 0 && q <= minStock) return 'low'
  return 'ok'
}

/** Recherche tolérante : sans accents, sans casse, sur nom / référence / code-barres / marque. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
