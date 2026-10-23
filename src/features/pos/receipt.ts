import { formatDateTime, formatQty } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { paymentLabel } from '@/lib/share'
import { type CartLine, cartTotals, lineTotal, type PaymentLine } from './cart'

/** Instantané d'une vente terminée : ce qui est imprimé et envoyé au client. */
export interface ReceiptData {
  number: string
  createdAt: string
  timezone: string
  currency: string
  orgName: string
  orgPhone: string | null
  orgAddress: string | null
  storeName: string
  header: string
  footer: string
  customerName: string | null
  customerPhone: string | null
  lines: CartLine[]
  globalDiscount: number
  payments: PaymentLine[]
  change: number
}

export function receiptTotals(r: ReceiptData) {
  const t = cartTotals(r.lines, r.globalDiscount)
  const paid = r.payments.reduce((s, p) => s + p.amount, 0)
  return { ...t, paid, due: t.total - paid }
}

/** Texte du ticket pour WhatsApp (gras avec *…*, lisible sur un petit écran). */
export function receiptText(r: ReceiptData): string {
  const m = (n: number) => formatMoney(n, r.currency)
  const t = receiptTotals(r)
  const out = [
    `*${r.orgName}*`,
    r.storeName,
    `Ticket ${r.number} · ${formatDateTime(r.createdAt, r.timezone)}`,
    '',
    ...r.lines.map((l) => `${l.name}\n  ${formatQty(l.quantity, l.unit)} × ${m(l.unitPrice)}${l.discount ? ` − ${m(l.discount)}` : ''} = ${m(lineTotal(l))}`),
    '',
  ]
  if (t.discount > 0) out.push(`Remises : −${m(t.discount)}`)
  out.push(`*Total : ${m(t.total)}*`)
  for (const p of r.payments) out.push(`${paymentLabel(p.method)} : ${m(p.amount)}`)
  if (r.change > 0) out.push(`Monnaie rendue : ${m(r.change)}`)
  if (t.due > 0) out.push(`*Reste dû : ${m(t.due)}*`)
  if (r.footer) out.push('', r.footer)
  return out.join('\n')
}
