import { formatDateTime, formatQty } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { PrintRow as Row, PrintRule as Rule } from '@/lib/print/print-rows'
import { paymentLabel } from '@/lib/share'
import { lineTotal } from '../cart'
import { type ReceiptData, receiptTotals } from '../receipt'

/** Ticket de caisse thermique (noir sur blanc, sans couleur ni ombre). */
export function Receipt({ data: r }: { data: ReceiptData }) {
  const m = (n: number) => formatMoney(n, r.currency)
  const t = receiptTotals(r)
  return (
    <div>
      <div className="text-center">
        <div className="text-sm font-extrabold">{r.orgName}</div>
        {r.header && <div className="whitespace-pre-line">{r.header}</div>}
        <div>{r.storeName}</div>
        {r.orgAddress && <div>{r.orgAddress}</div>}
        {r.orgPhone && <div>Tél. {r.orgPhone}</div>}
      </div>
      <Rule />
      <Row label={`Ticket ${r.number}`} value={formatDateTime(r.createdAt, r.timezone)} />
      {r.customerName && <div>Client : {r.customerName}</div>}
      <Rule />
      {r.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <div>{l.name}</div>
          <Row label={`  ${formatQty(l.quantity, l.unit)} × ${m(l.unitPrice)}`} value={m(lineTotal(l))} />
          {l.discount > 0 && <Row label="  Remise" value={`−${m(l.discount)}`} />}
        </div>
      ))}
      <Rule />
      {t.discount > 0 && <Row label="Remises" value={`−${m(t.discount)}`} />}
      <div className="text-sm"><Row label="TOTAL" value={m(t.total)} bold /></div>
      {r.payments.map((p) => <Row key={p.method} label={paymentLabel(p.method)} value={m(p.amount)} />)}
      {r.change > 0 && <Row label="Monnaie rendue" value={m(r.change)} />}
      {t.due > 0 && <Row label="Reste dû (crédit)" value={m(t.due)} bold />}
      {r.footer && (<><Rule /><div className="text-center whitespace-pre-line">{r.footer}</div></>)}
    </div>
  )
}
