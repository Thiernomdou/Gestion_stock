import { formatDateTime } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { PrintRow as Row, PrintRule as Rule } from '@/lib/print/print-rows'
import { paymentLabel } from '@/lib/share'
import { cn } from '@/lib/utils'
import type { SessionSummary } from '../api'

const t = fr.cash

/** Écart de caisse : vert si juste, ambre si excédent, rouge si manquant. */
export function DifferenceBadge({ value, currency, className }: { value: number; currency: string; className?: string }) {
  const label = value === 0 ? t.balanced : value > 0 ? t.surplus : t.shortage
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap tabular-nums',
        value === 0 ? 'bg-success-soft text-success' : value > 0 ? 'bg-warning-soft text-warning' : 'bg-destructive-soft text-destructive',
        className,
      )}
    >
      {label}{value !== 0 && ` ${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value), currency)}`}
    </span>
  )
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', muted && 'text-sm text-muted-foreground', strong && 'text-lg font-extrabold')}>
      <dt>{label}</dt><dd className="font-semibold whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  )
}

/** Résumé d'une journée (écran) : ventes, encaissements par mode, espèces attendues. */
export function SessionSummaryView({ summary: s, currency }: { summary: SessionSummary; currency: string }) {
  const m = (n: number) => formatMoney(n, currency)
  const cash = s.payments.find((p) => p.method === 'cash')

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="grid content-start gap-3 rounded-3xl p-4 surface sm:p-5">
        <h2 className="text-lg font-bold tracking-tight">{t.sales}</h2>
        <p className="text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">{m(s.sales_total)}</p>
        <dl className="grid gap-1.5">
          <Line label={t.salesCount(s.sales_count)} value="" muted />
          {s.discounts > 0 && <Line label={t.discounts} value={`−${m(s.discounts)}`} muted />}
          {s.credit_given > 0 && <Line label={t.credit} value={m(s.credit_given)} muted />}
          {s.cancelled_count > 0 && <Line label={t.cancelled(s.cancelled_count)} value="" muted />}
        </dl>
      </section>

      <section className="grid content-start gap-3 rounded-3xl p-4 surface sm:p-5">
        <h2 className="text-lg font-bold tracking-tight">{t.byMethod}</h2>
        {s.payments.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <dl className="grid gap-2">
            {s.payments.map((p) => (
              <div key={p.method} className="grid gap-0.5">
                <Line label={paymentLabel(p.method)} value={m(p.net)} />
                {p.repayments !== 0 && <Line label={t.repayments} value={m(p.repayments)} muted />}
                {p.refunds !== 0 && <Line label={t.refunds} value={m(p.refunds)} muted />}
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="grid content-start gap-2 rounded-3xl bg-linear-to-br from-ink to-ink-2 p-4 text-white sm:col-span-2 sm:p-5">
        <dl className="grid gap-1.5 [&_dt]:text-white/75">
          <Line label={t.openingFloat} value={m(s.session.opening_float)} />
          <Line label={`+ ${t.cashIn}`} value={m(cash?.net ?? 0)} />
          {s.expenses_cash > 0 && <Line label={`− ${t.expensesCash}`} value={m(s.expenses_cash)} />}
          <div className="my-1 border-t border-white/15" />
          <Line label={`= ${t.expected}`} value={m(s.expected_cash)} strong />
        </dl>
      </section>
    </div>
  )
}

/** Rapport Z imprimable (ticket 58/80 mm, noir sur blanc). */
export function ZReport({ summary: s, orgName, currency, timezone }: { summary: SessionSummary; orgName: string; currency: string; timezone: string }) {
  const m = (n: number) => formatMoney(n, currency)
  const cash = s.payments.find((p) => p.method === 'cash')
  return (
    <div>
      <div className="text-center">
        <div className="text-sm font-extrabold">{orgName}</div>
        <div>{s.store_name}</div>
        <div className="mt-1 text-sm font-extrabold">{t.zReport}</div>
      </div>
      <Rule />
      <Row label="Ouverture" value={formatDateTime(s.session.opened_at, timezone)} />
      {s.session.closed_at && <Row label="Clôture" value={formatDateTime(s.session.closed_at, timezone)} />}
      {s.opened_by_name && <Row label="Ouverte par" value={s.opened_by_name} />}
      {s.closed_by_name && <Row label="Clôturée par" value={s.closed_by_name} />}
      <Rule />
      <Row label={t.salesCount(s.sales_count)} value={m(s.sales_total)} bold />
      {s.discounts > 0 && <Row label={t.discounts} value={m(s.discounts)} />}
      {s.credit_given > 0 && <Row label={t.credit} value={m(s.credit_given)} />}
      {s.cancelled_count > 0 && <Row label={t.cancelled(s.cancelled_count)} value="" />}
      <Rule />
      {s.payments.map((p) => <Row key={p.method} label={paymentLabel(p.method)} value={m(p.net)} />)}
      <Rule />
      <Row label={t.openingFloat} value={m(s.session.opening_float)} />
      <Row label={t.cashIn} value={m(cash?.net ?? 0)} />
      <Row label={t.expensesCash} value={m(s.expenses_cash)} />
      <Row label={t.expected} value={m(s.expected_cash)} bold />
      {s.session.counted_cash !== null && (
        <>
          <Row label={t.counted} value={m(s.session.counted_cash)} bold />
          <Row label={t.difference} value={m(s.session.difference ?? 0)} bold />
        </>
      )}
      {s.session.notes && (<><Rule /><div className="whitespace-pre-line">{s.session.notes}</div></>)}
    </div>
  )
}
