import { ChevronRight, History, Loader2, LockKeyhole, Printer, ShoppingCart, Wallet } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MoneyInput } from '@/components/amount-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, formatTime } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { can } from '@/lib/permissions'
import { PrintArea } from '@/lib/print/print-area'
import { type SessionSummary, useCashHistory, useCloseCashSession, useOpenSession, useSessionSummary } from '../api'
import { DifferenceBadge, SessionSummaryView, ZReport } from './SessionSummaryView'

const t = fr.cash

/** Journée de caisse de la boutique en cours : résumé en direct, clôture, historique. */
export function CashDayPage() {
  const { org, role, store } = useCurrentOrg()
  const session = useOpenSession(store?.id)
  const summary = useSessionSummary(session.data?.id)
  const history = useCashHistory(store?.id)

  if (!can(role, 'sell')) return <Navigate to="/" replace />

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5">
      <PageHeader back="/caisse" title={t.title} description={store ? `${store.name} · ${t.description}` : t.description} />

      {session.isPending || (session.data && summary.isPending) ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-32 rounded-3xl sm:col-span-2" /></div>
      ) : session.error || summary.error ? (
        <ErrorState message={errorMessage(session.error ?? summary.error)} onRetry={() => { void session.refetch(); void summary.refetch() }} retryLabel={fr.app.retry} />
      ) : !session.data || !summary.data ? (
        <EmptyState
          icon={Wallet}
          title={t.noSession}
          action={<Button asChild size="lg"><Link to="/caisse"><ShoppingCart /> {t.goToPos}</Link></Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold tracking-tight">{t.current}</h2>
            <p className="text-sm font-semibold text-muted-foreground">
              {t.openedAt(formatTime(session.data.opened_at, org.timezone))}
              {summary.data.opened_by_name && ` ${t.openedBy(summary.data.opened_by_name)}`}
            </p>
          </div>
          <SessionSummaryView summary={summary.data} currency={org.currency} />
          <CloseForm summary={summary.data} />
        </>
      )}

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><History className="size-5 text-muted-foreground" aria-hidden /> {t.history}</h2>
        {history.isPending ? (
          <Skeleton className="h-20 rounded-3xl" />
        ) : !history.data?.length ? (
          <p className="rounded-3xl bg-muted/60 p-4 text-base text-muted-foreground">{t.noHistory}</p>
        ) : (
          <ul className="grid gap-2">
            {history.data.map((s, i) => (
              <li key={s.id} style={{ '--i': i } as CSSProperties} className="stagger">
                <Link to={`/caisse/journees/${s.id}`} className="flex items-center gap-3 rounded-3xl p-3 pl-4 surface transition-shadow hover:shadow-raised">
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold capitalize">{formatDate(s.opened_at, org.timezone)}</span>
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {formatTime(s.opened_at, org.timezone)} → {s.closed_at ? formatTime(s.closed_at, org.timezone) : '—'} · {formatMoney(s.counted_cash ?? 0, org.currency)}
                    </span>
                  </span>
                  <DifferenceBadge value={Number(s.difference ?? 0)} currency={org.currency} className="hidden min-[400px]:inline-flex" />
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Clôture : le vendeur compte le tiroir ; l'attendu et l'écart s'affichent pendant la saisie. */
function CloseForm({ summary }: { summary: SessionSummary }) {
  const { org } = useCurrentOrg()
  const navigate = useNavigate()
  const close = useCloseCashSession()
  const [counted, setCounted] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const diff = counted === null ? null : counted - summary.expected_cash
  const m = (n: number) => formatMoney(n, org.currency)

  const submit = () => close.mutate(
    { sessionId: summary.session.id, counted: counted ?? 0, notes },
    {
      onSuccess: () => { toast.success(t.closed); navigate(`/caisse/journees/${summary.session.id}`, { replace: true }) },
      onError: (e) => toast.error(errorMessage(e)),
    },
  )

  return (
    <section className="grid gap-4 rounded-3xl p-4 surface sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><LockKeyhole className="size-5" aria-hidden /></span>
        {t.closeTitle}
      </h2>
      <p className="text-base text-muted-foreground">{t.closeText}</p>
      <div className="grid gap-1.5">
        <Label htmlFor="counted" className="text-base">{t.counted}</Label>
        <MoneyInput id="counted" value={counted} onChange={setCounted} suffix={org.currency} className="h-14 text-2xl" />
      </div>
      {diff !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/70 p-3.5">
          <span className="text-sm font-semibold text-muted-foreground">{t.expected} : <span className="text-foreground tabular-nums">{m(summary.expected_cash)}</span></span>
          <DifferenceBadge value={diff} currency={org.currency} />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="close-notes" className="text-base">{t.notes}</Label>
        <textarea
          id="close-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder={t.notesPlaceholder}
          className="min-h-16 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <ConfirmDialog
        trigger={
          <Button size="lg" className="w-full" disabled={counted === null || close.isPending}>
            {close.isPending && <Loader2 className="animate-spin" />} {t.close}
          </Button>
        }
        title={t.closeTitle}
        description={diff ? t.closeConfirm(`${diff > 0 ? '+' : '−'}${m(Math.abs(diff))}`) : t.closeConfirmBalanced}
        confirmLabel={t.close}
        onConfirm={submit}
      />
    </section>
  )
}

/** Rapport Z d'une journée (clôturée ou en cours) : affichage et impression. */
export function SessionReportPage() {
  const { id } = useParams()
  const { org, role, settings } = useCurrentOrg()
  const summary = useSessionSummary(id)

  if (!can(role, 'sell')) return <Navigate to="/" replace />
  if (summary.isPending) return <div className="mx-auto grid w-full max-w-3xl gap-4"><Skeleton className="h-10 w-1/2 rounded-xl" /><Skeleton className="h-64 rounded-3xl" /></div>
  if (summary.error || !summary.data) {
    return <ErrorState message={summary.error ? errorMessage(summary.error) : t.notFound} onRetry={() => void summary.refetch()} retryLabel={fr.app.retry} />
  }

  const s = summary.data
  const closed = s.session.status === 'closed'
  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5">
      <PageHeader
        back="/caisse/journee"
        title={`${t.zReport} · ${formatDate(s.session.opened_at, org.timezone)}`}
        description={[
          s.store_name,
          closed && s.session.closed_at ? t.period(formatDateTime(s.session.opened_at, org.timezone), formatDateTime(s.session.closed_at, org.timezone)) : null,
          s.closed_by_name ? t.closedBy(s.closed_by_name) : null,
        ].filter(Boolean).join(' · ')}
        actions={<Button size="lg" variant="outline" onClick={() => window.print()}><Printer /> {t.printZ}</Button>}
      />

      {closed && s.session.counted_cash !== null && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 surface sm:p-5">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">{t.counted}</p>
            <p className="text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums">{formatMoney(s.session.counted_cash, org.currency)}</p>
          </div>
          <DifferenceBadge value={Number(s.session.difference ?? 0)} currency={org.currency} className="h-10 px-4 text-base" />
        </section>
      )}
      <SessionSummaryView summary={s} currency={org.currency} />
      {s.session.notes && <p className="rounded-3xl bg-muted/60 p-4 text-base whitespace-pre-line">{s.session.notes}</p>}

      <PrintArea widthMm={settings.receipt.width_mm}>
        <ZReport summary={s} orgName={org.name} currency={org.currency} timezone={org.timezone} />
      </PrintArea>
    </div>
  )
}
