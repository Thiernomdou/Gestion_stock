import { Banknote, Loader2, Plus, Smartphone, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MoneyInput } from '@/components/amount-input'
import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { paymentLabel } from '@/lib/share'
import { cn } from '@/lib/utils'
import { type CashSession, useCreateSale, useCustomers } from '../api'
import { type CartTotals, cashSuggestions, paymentsToRecord, summarizePayments } from '../cart'
import type { ReceiptData } from '../receipt'
import type { Cart } from '../store'
import { CustomerPicker } from './CustomerPicker'

const t = fr.pos

interface DraftPayment { key: string; method: string; amount: number | null; reference: string }

const methodIcon = (method: string) => (method === 'cash' ? Banknote : method === 'bank' ? Wallet : Smartphone)

/** Paiement : espèces avec monnaie à rendre, paiement mixte, ou crédit (client obligatoire). */
export function CheckoutSheet({ open, onOpenChange, cart, totals, session, onDone }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: Cart
  totals: CartTotals
  session: CashSession
  onDone: (receipt: ReceiptData) => void
}) {
  const { org, store, settings } = useCurrentOrg()
  const customers = useCustomers(org.id)
  const createSale = useCreateSale(org.id)
  const methods = settings.payment_methods.length > 0 ? settings.payment_methods : ['cash']
  const [payments, setPayments] = useState<DraftPayment[]>(() => [{ key: crypto.randomUUID(), method: methods[0]!, amount: null, reference: '' }])
  const [customerId, setCustomerId] = useState<string | null>(cart.customerId)

  const m = (n: number) => formatMoney(n, org.currency)
  const entered = payments.map((p) => ({ method: p.method, amount: p.amount ?? 0 }))
  const sum = summarizePayments(totals.total, entered)
  const needsCustomer = sum.remaining > 0
  const canSubmit = !createSale.isPending && store !== null && (!needsCustomer || customerId !== null)

  // Montant exact attendu sur une ligne : le total moins ce que paient les autres lignes.
  const exactFor = (key: string) =>
    Math.max(0, totals.total - payments.filter((x) => x.key !== key).reduce((s, x) => s + (x.amount ?? 0), 0))
  const update = (key: string, patch: Partial<DraftPayment>) =>
    setPayments((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const addPayment = () => {
    const used = new Set(payments.map((p) => p.method))
    const method = methods.find((x) => !used.has(x)) ?? methods[0]!
    setPayments((list) => [...list, { key: crypto.randomUUID(), method, amount: sum.remaining || null, reference: '' }])
  }

  const submit = () => {
    if (!store || !canSubmit) return
    const recorded = paymentsToRecord(
      totals.total,
      payments.map((p) => (p.reference.trim() ? { method: p.method, amount: p.amount ?? 0, reference: p.reference.trim() } : { method: p.method, amount: p.amount ?? 0 })),
    )
    createSale.mutate(
      { id: cart.saleId, storeId: store.id, sessionId: session.id, customerId, lines: cart.lines, globalDiscount: cart.globalDiscount, payments: recorded },
      {
        onSuccess: (sale) => {
          const customer = customers.data?.find((c) => c.id === customerId) ?? null
          onDone({
            number: sale.number, createdAt: sale.created_at, timezone: org.timezone, currency: org.currency,
            orgName: org.name, orgPhone: org.phone, orgAddress: org.address, storeName: store.name,
            header: settings.receipt.header, footer: settings.receipt.footer,
            customerName: customer?.name ?? null, customerPhone: customer?.phone ?? null,
            lines: cart.lines, globalDiscount: cart.globalDiscount, payments: recorded, change: sum.change,
          })
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !createSale.isPending && onOpenChange(o)}
      title={t.payTitle}
      footer={
        <Button size="lg" className="w-full" onClick={submit} disabled={!canSubmit}>
          {createSale.isPending && <Loader2 className="animate-spin" />}
          {needsCustomer ? t.validateCredit : t.validate}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-3xl bg-linear-to-br from-ink to-ink-2 p-5 text-white">
          <p className="text-sm font-semibold text-white/70">{t.toPay}</p>
          <p className="mt-1 text-[2.25rem] leading-none font-extrabold tracking-tight tabular-nums">{m(totals.total)}</p>
          <p className="mt-2 text-sm text-white/70">{t.items(totals.items)}</p>
        </div>

        <ul className="grid grid-cols-1 gap-3">
          {payments.map((p) => {
            const Icon = methodIcon(p.method)
            return (
              <li key={p.key} className="grid min-w-0 grid-cols-1 gap-3 rounded-3xl bg-muted/60 p-3">
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label={t.payTitle}>
                  {methods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      role="radio"
                      aria-checked={p.method === method}
                      onClick={() => update(p.key, { method })}
                      className={cn(
                        'h-10 shrink-0 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors',
                        p.method === method ? 'bg-primary text-primary-foreground shadow-primary' : 'bg-card shadow-card',
                      )}
                    >
                      {paymentLabel(method)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card text-primary shadow-card"><Icon className="size-6" aria-hidden /></span>
                  <MoneyInput
                    value={p.amount}
                    onChange={(amount) => update(p.key, { amount })}
                    suffix={org.currency}
                    aria-label={`${t.received} — ${paymentLabel(p.method)}`}
                    placeholder={t.received}
                    className="h-12 text-xl"
                  />
                  {payments.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" aria-label={t.remove} onClick={() => setPayments((l) => l.filter((x) => x.key !== p.key))}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  )}
                </div>
                {p.method === 'cash' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[exactFor(p.key), ...cashSuggestions(exactFor(p.key))]
                      .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                      .map((v, i) => (
                        <button key={v} type="button" onClick={() => update(p.key, { amount: v })}
                                className="h-10 rounded-xl bg-card px-3 text-sm font-bold tabular-nums shadow-card active:scale-95">
                          {i === 0 ? t.exact : m(v)}
                        </button>
                      ))}
                  </div>
                ) : (
                  <Input value={p.reference} onChange={(e) => update(p.key, { reference: e.target.value })} placeholder={t.reference} aria-label={t.reference} maxLength={60} />
                )}
              </li>
            )
          })}
        </ul>
        {methods.length > 1 && (
          <Button type="button" variant="outline" className="border-dashed" onClick={addPayment}><Plus /> {t.addMethod}</Button>
        )}

        <dl className="grid gap-1.5 rounded-3xl p-4 surface">
          <div className="flex justify-between text-base"><dt className="text-muted-foreground">{t.paid}</dt><dd className="font-bold tabular-nums">{m(sum.paid)}</dd></div>
          {sum.change > 0 && (
            <div className="flex items-baseline justify-between rounded-2xl bg-success-soft px-3 py-2 text-success">
              <dt className="font-bold">{t.change}</dt><dd className="text-2xl font-extrabold tabular-nums">{m(sum.change)}</dd>
            </div>
          )}
          {sum.remaining > 0 && (
            <>
              <div className="flex items-baseline justify-between rounded-2xl bg-warning-soft px-3 py-2 text-warning">
                <dt className="font-bold">{t.remaining}</dt><dd className="text-2xl font-extrabold tabular-nums">{m(sum.remaining)}</dd>
              </div>
              <p className="text-sm text-muted-foreground">{t.creditNote}</p>
            </>
          )}
        </dl>

        <CustomerPicker value={customerId} onChange={setCustomerId} required={needsCustomer} />
      </div>
    </BottomSheet>
  )
}
