import { CheckCircle2, CircleAlert, Download, FileSpreadsheet, FileUp, Loader2, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { formatQty } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { formatMoney } from '@/lib/money'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { type ImportResult, useImportProducts } from '../api'
import { buildImportPreview, FIELD_LABELS, type ImportPreview, importTemplateCsv, parseCsv } from '../csv'

const t = fr.products.importPage
const MAX_ROWS = 5000
const MAX_BYTES = 5 * 1024 * 1024

type State =
  | { step: 'choose'; error?: string }
  | { step: 'preview'; fileName: string; preview: ImportPreview }
  | { step: 'done'; result: ImportResult }

/** Excel « CSV UTF-8 » est en UTF-8 ; « CSV (séparateur : point-virgule) » sous Windows est en Windows-1252. */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="grid animate-rise gap-4 rounded-3xl p-4 surface sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span className={cn('grid size-10 place-items-center rounded-xl text-base font-extrabold', done ? 'bg-success text-white' : 'bg-primary text-primary-foreground shadow-primary')}>
          {done ? <CheckCircle2 className="size-5" aria-hidden /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function ImportPage() {
  const { org, role, store } = useCurrentOrg()
  const importer = useImportProducts(org.id)
  const fileInput = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ step: 'choose' })

  if (!can(role, 'manage_products')) return <Navigate to="/produits" replace />

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) return setState({ step: 'choose', error: t.tooLarge })
    const table = parseCsv(await readText(file))
    if (table.length < 2) return setState({ step: 'choose', error: t.empty })
    if (table.length - 1 > MAX_ROWS) return setState({ step: 'choose', error: t.tooLarge })
    setState({ step: 'preview', fileName: file.name, preview: buildImportPreview(table) })
  }

  const reset = () => {
    importer.reset()
    setState({ step: 'choose' })
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4">
      <PageHeader back="/produits" title={t.title} description={t.description} />

      <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1}
             onChange={(e) => void onFile(e.target.files?.[0])} />

      {state.step === 'done' ? (
        <section className="grid animate-rise justify-items-center gap-4 rounded-3xl p-6 text-center surface sm:p-8">
          <span className="grid size-16 place-items-center rounded-2xl bg-success text-white shadow-card"><CheckCircle2 className="size-9" aria-hidden /></span>
          <h2 className="text-2xl font-extrabold tracking-tight">{t.doneTitle}</h2>
          <ul className="grid w-full max-w-sm gap-1.5 rounded-2xl bg-muted/60 p-4 text-left text-base">
            <li>{t.done.created(state.result.created)}</li>
            <li>{t.done.updated(state.result.updated)}</li>
            <li>{t.done.stock(state.result.stock_entries)}</li>
            {state.result.categories_created > 0 && <li>{t.done.categories(state.result.categories_created)}</li>}
            {state.result.stock_skipped > 0 && <li className="font-semibold text-warning">{t.done.skipped(state.result.stock_skipped)}</li>}
          </ul>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="lg"><Link to="/produits">{t.seeProducts}</Link></Button>
            <Button variant="outline" size="lg" onClick={reset}><RotateCcw /> {t.other}</Button>
          </div>
        </section>
      ) : (
        <>
          <Step n={1} title={t.step1} done={state.step === 'preview'}>
            <p className="text-base text-muted-foreground">{t.step1Text}</p>
            <Button variant="outline" size="lg" className="justify-self-start" onClick={() => download('modele-produits.csv', importTemplateCsv(org.currency))}>
              <Download /> {t.template}
            </Button>
          </Step>

          <Step n={2} title={t.step2}>
            {state.step === 'choose' ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-primary/35 bg-accent/40 px-4 py-10 text-center transition-colors hover:border-primary/60 hover:bg-accent active:scale-[0.99]"
                >
                  <span className="mb-1 grid size-16 place-items-center rounded-2xl bg-card text-primary shadow-card"><FileUp className="size-8" aria-hidden /></span>
                  <span className="text-lg font-bold text-accent-foreground">{t.choose}</span>
                  <span className="text-sm text-muted-foreground">{t.chooseHint}</span>
                </button>
                <p className="text-sm text-muted-foreground">{t.excelHint}</p>
                {state.error && <p role="alert" className="rounded-xl bg-destructive-soft p-3 font-semibold text-destructive">{state.error}</p>}
              </>
            ) : (
              <Preview
                fileName={state.fileName}
                preview={state.preview}
                currency={org.currency}
                storeName={store?.name ?? ''}
                pending={importer.isPending}
                error={importer.error ? errorMessage(importer.error) : null}
                onOther={reset}
                onSubmit={() => store && importer.mutate(
                  { storeId: store.id, rows: state.preview.rows },
                  { onSuccess: (result) => setState({ step: 'done', result }) },
                )}
              />
            )}
          </Step>
        </>
      )}
    </div>
  )
}

function Preview({ fileName, preview, currency, storeName, pending, error, onOther, onSubmit }: {
  fileName: string; preview: ImportPreview; currency: string; storeName: string
  pending: boolean; error: string | null; onOther: () => void; onSubmit: () => void
}) {
  const { rows, errors, columns } = preview
  const ok = errors.length === 0 && rows.length > 0
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3.5">
        <FileSpreadsheet className="size-8 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{fileName}</p>
          <p className={cn('text-sm font-semibold', ok ? 'text-success' : 'text-destructive')}>
            {t.rows(rows.length)} · {ok ? t.ready : t.errors(errors.length)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onOther} disabled={pending}>{t.other}</Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">{t.columns}</p>
        <ul className="flex flex-wrap gap-1.5">
          {columns.map((c, i) => (
            <li key={i} className={cn('rounded-lg px-2.5 py-1 text-sm font-medium', c.field ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground line-through')}>
              {c.header || '?'}{c.field ? ` → ${FIELD_LABELS[c.field]}` : ` (${t.ignored})`}
            </li>
          ))}
        </ul>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="grid max-h-72 gap-1 overflow-y-auto rounded-2xl bg-destructive-soft p-3.5">
          {errors.slice(0, 100).map((e, i) => (
            <li key={i} className="flex gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span><span className="font-bold">{t.line(e.line)}</span> — {e.message}</span>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">{t.preview}</p>
          <ul className="divide-y overflow-hidden rounded-2xl border">
            {rows.slice(0, 6).map((r) => (
              <li key={r.line} className="flex items-center gap-3 bg-card px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name || '—'}</span>
                  <span className="block truncate text-sm text-muted-foreground">{[r.category, r.sku, r.unit].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  {r.sale_price !== null && <span className="block font-bold">{formatMoney(r.sale_price, currency)}</span>}
                  {r.opening_qty !== null && <span className="block text-muted-foreground">{formatQty(r.opening_qty, r.unit ?? undefined)}</span>}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 6 && <p className="mt-2 text-sm text-muted-foreground">{t.previewMore(rows.length - 6)}</p>}
        </div>
      )}

      {rows.some((r) => r.opening_qty) && <p className="rounded-xl bg-accent/60 p-3 text-sm font-medium text-accent-foreground">{t.openingStore(storeName)}</p>}
      {error && <p role="alert" className="rounded-xl bg-destructive-soft p-3 font-semibold text-destructive">{error}</p>}

      <Button size="lg" onClick={onSubmit} disabled={!ok || pending}>
        {pending ? <><Loader2 className="animate-spin" /> {t.importing}</> : t.submit(rows.length)}
      </Button>
    </div>
  )
}
