// Calculs du panier : aperçu uniquement (CLAUDE.md §8). Le serveur (create_sale) recalcule
// et contrôle tout ; ces règles doivent rester identiques aux siennes.
import { toMoney } from '@/lib/money'

export type PriceMode = 'retail' | 'wholesale'

export interface CartLine {
  /** Identifiant de la ligne de vente (sale_items.id), fixé à l'ajout. */
  id: string
  productId: string
  name: string
  unit: string
  decimal: boolean
  quantity: number
  priceMode: PriceMode
  unitPrice: number
  /** Remise de la ligne, en montant. */
  discount: number
}

export interface PaymentLine {
  method: string
  amount: number
  reference?: string
}

/** Montant brut d'une ligne : arrondi à l'entier, comme `round(qty * price)` côté SQL. */
export function lineGross(line: Pick<CartLine, 'quantity' | 'unitPrice'>): number {
  return toMoney(line.quantity * line.unitPrice)
}

export function lineTotal(line: CartLine): number {
  return lineGross(line) - line.discount
}

export interface CartTotals {
  subtotal: number
  discount: number
  total: number
  items: number
}

export function cartTotals(lines: CartLine[], globalDiscount: number): CartTotals {
  let subtotal = 0, discount = 0
  for (const l of lines) {
    subtotal += lineGross(l)
    discount += l.discount
  }
  discount += globalDiscount
  return { subtotal, discount, total: subtotal - discount, items: lines.length }
}

/** Remise maximale permise sur un panier (montant), selon le rôle et les paramètres. */
export function maxDiscount(subtotal: number, isManager: boolean, settings: { cashier_can_discount: boolean; max_discount_percent: number }): number {
  if (isManager) return subtotal
  if (!settings.cashier_can_discount) return 0
  return Math.floor((subtotal * settings.max_discount_percent) / 100)
}

/** Quantité arrondie à 3 décimales (numeric(14,3)), ou entière si l'unité ne se fractionne pas. */
export function normalizeQty(qty: number, decimal: boolean): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  return decimal ? Math.round(qty * 1000) / 1000 : Math.round(qty)
}

export interface PaymentSummary {
  paid: number
  /** Reste dû (≥ 0) : passe en crédit client. */
  remaining: number
  /** Trop-perçu en espèces : monnaie à rendre. */
  change: number
}

/**
 * Paiements saisis → montant encaissé, reste à payer (crédit) et monnaie à rendre.
 * Seules les espèces peuvent dépasser le total : l'excédent est rendu au client
 * et n'est pas enregistré (le serveur refuse un paiement supérieur au total).
 */
export function summarizePayments(total: number, payments: PaymentLine[]): PaymentSummary {
  const nonCash = payments.filter((p) => p.method !== 'cash').reduce((s, p) => s + p.amount, 0)
  const cash = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
  const cashUsed = Math.max(0, Math.min(cash, total - nonCash))
  const paid = nonCash + cashUsed
  return { paid, remaining: Math.max(0, total - paid), change: cash - cashUsed }
}

/** Paiements à envoyer au serveur : espèces ramenées au montant réellement gardé. */
export function paymentsToRecord(total: number, payments: PaymentLine[]): PaymentLine[] {
  const nonCash = payments.filter((p) => p.method !== 'cash' && p.amount > 0)
  const cashGiven = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
  const cashKept = Math.max(0, Math.min(cashGiven, total - nonCash.reduce((s, p) => s + p.amount, 0)))
  return cashKept > 0 ? [{ method: 'cash', amount: cashKept }, ...nonCash] : nonCash
}

const NOTE_STEPS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000]

/** Montants reçus probables (billets) au-dessus du total : raccourcis pour la monnaie à rendre. */
export function cashSuggestions(total: number, count = 3): number[] {
  if (total <= 0) return []
  const out = new Set<number>()
  for (const step of NOTE_STEPS) {
    if (step < total / 50) continue
    const v = Math.ceil(total / step) * step
    if (v > total) out.add(v)
  }
  return [...out].sort((a, b) => a - b).slice(0, count)
}
