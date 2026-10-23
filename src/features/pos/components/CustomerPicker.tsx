import { Check, Loader2, Search, UserPlus, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentOrg } from '@/features/organization/context'
import { normalizeSearch } from '@/features/products/schema'
import { errorMessage } from '@/lib/errors'
import { initials } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { cn } from '@/lib/utils'
import { type Customer, useCreateCustomer, useCustomers } from '../api'

const t = fr.pos

/** Choix du client (obligatoire pour une vente à crédit), avec création rapide depuis la caisse. */
export function CustomerPicker({ value, onChange, required }: {
  value: string | null; onChange: (id: string | null) => void; required: boolean
}) {
  const { org } = useCurrentOrg()
  const customers = useCustomers(org.id)
  const create = useCreateCustomer(org.id)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const selected = customers.data?.find((c) => c.id === value) ?? null
  const list = useMemo(() => {
    const q = normalizeSearch(query)
    const digits = query.replace(/\D/g, '')
    return (customers.data ?? [])
      .filter((c) => !q || normalizeSearch(c.name).includes(q) || (digits.length > 2 && c.phone?.replace(/\D/g, '').includes(digits)))
      .slice(0, 30)
  }, [customers.data, query])

  const pick = (c: Customer | null) => { onChange(c?.id ?? null); setOpen(false); setQuery('') }

  const submitNew = () => {
    if (name.trim().length < 2) return
    create.mutate(
      { name: name.trim(), phone: phone.trim() || null },
      {
        onSuccess: (id) => { onChange(id); setCreating(false); setOpen(false); setName(''); setPhone('') },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors',
          required && !selected ? 'border-destructive/50 bg-destructive-soft' : 'border-transparent bg-muted/70 hover:bg-muted',
        )}
      >
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold', selected ? 'bg-linear-to-b from-ink-2 to-ink text-white' : 'bg-card text-muted-foreground shadow-card')}>
          {selected ? initials(selected.name) : <UserRound className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted-foreground">{t.customer}</span>
          <span className={cn('block truncate text-base font-bold', required && !selected && 'text-destructive')}>
            {selected ? selected.name : required ? t.customerRequired : t.noCustomer}
          </span>
        </span>
        <span className="text-sm font-semibold text-primary">{t.chooseCustomer}</span>
      </button>
    )
  }

  return (
    <div className="grid animate-rise gap-3 rounded-2xl bg-muted/70 p-3">
      {creating ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.customerName} aria-label={t.customerName} autoFocus maxLength={80} />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} aria-label={t.phone} type="tel" inputMode="tel" maxLength={30} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>{fr.app.cancel}</Button>
            <Button type="button" className="flex-1" onClick={submitNew} disabled={name.trim().length < 2 || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />} {t.createCustomer}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchCustomer} aria-label={t.searchCustomer} className="pl-10" autoFocus />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={fr.app.cancel} onClick={() => setOpen(false)}><X /></Button>
          </div>
          <ul className="grid max-h-60 gap-1 overflow-y-auto">
            {!required && (
              <li>
                <button type="button" onClick={() => pick(null)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left font-semibold text-muted-foreground hover:bg-card">
                  {t.noCustomer} {value === null && <Check className="ml-auto size-4 text-primary" />}
                </button>
              </li>
            )}
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => pick(c)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left hover:bg-card">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{c.name}</span>
                    {c.phone && <span className="block text-sm text-muted-foreground">{c.phone}</span>}
                  </span>
                  {c.id === value && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={() => { setCreating(true); setName(query) }}>
            <UserPlus /> {t.newCustomer}
          </Button>
        </>
      )}
    </div>
  )
}
