import { CheckCircle2, MessageCircle, Printer, ShoppingCart } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { Button } from '@/components/ui/button'
import { useCurrentOrg } from '@/features/organization/context'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { PrintArea } from '@/lib/print/print-area'
import { whatsappUrl } from '@/lib/share'
import { type ReceiptData, receiptText, receiptTotals } from '../receipt'
import { Receipt } from './Receipt'

const t = fr.pos

/** Vente terminée : monnaie à rendre en grand, ticket imprimé ou envoyé par WhatsApp. */
export function SaleDone({ receipt, onNewSale }: { receipt: ReceiptData; onNewSale: () => void }) {
  const { org, settings } = useCurrentOrg()
  const m = (n: number) => formatMoney(n, receipt.currency)
  const totals = receiptTotals(receipt)

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && onNewSale()}
      title={t.doneTitle}
      footer={<Button size="lg" className="w-full" onClick={onNewSale} autoFocus><ShoppingCart /> {t.newSale}</Button>}
    >
      <div className="grid justify-items-center gap-4 text-center">
        <span className="grid size-16 animate-rise place-items-center rounded-2xl bg-success text-white shadow-card"><CheckCircle2 className="size-9" aria-hidden /></span>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Ticket {receipt.number}</p>
          <p className="text-[2rem] leading-tight font-extrabold tracking-tight tabular-nums">{m(totals.total)}</p>
        </div>
        {receipt.change > 0 && (
          <p className="w-full rounded-3xl bg-success-soft px-4 py-4 text-xl font-extrabold text-success">{t.giveChange(m(receipt.change))}</p>
        )}
        {totals.due > 0 && (
          <p className="w-full rounded-3xl bg-warning-soft px-4 py-3 text-base font-bold text-warning">
            {t.remaining} : {m(totals.due)}{receipt.customerName ? ` · ${receipt.customerName}` : ''}
          </p>
        )}
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button variant="outline" size="lg" onClick={() => window.print()}><Printer /> {t.print}</Button>
          <Button asChild variant="outline" size="lg">
            <a href={whatsappUrl(receiptText(receipt), receipt.customerPhone, org.country)} target="_blank" rel="noreferrer">
              <MessageCircle /> {t.whatsapp}
            </a>
          </Button>
        </div>
      </div>
      <PrintArea widthMm={settings.receipt.width_mm}><Receipt data={receipt} /></PrintArea>
    </BottomSheet>
  )
}
