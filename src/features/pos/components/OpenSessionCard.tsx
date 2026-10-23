import { Loader2, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MoneyInput } from '@/components/amount-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useOpenCashSession } from '../api'

const t = fr.pos

/** Caisse fermée : on saisit le fond de caisse pour démarrer la journée. */
export function OpenSessionCard({ storeId }: { storeId: string }) {
  const { org, store } = useCurrentOrg()
  const open = useOpenCashSession(org.id, storeId)
  const [float, setFloat] = useState<number | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    open.mutate(float ?? 0, { onError: (err) => toast.error(errorMessage(err)) })
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-md animate-rise gap-5 rounded-[2rem] p-6 surface sm:p-8">
      <div className="relative mx-auto">
        <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-2xl bg-accent" />
        <span className="relative grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-primary">
          <LockOpen className="size-8" aria-hidden />
        </span>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{t.closedTitle}</h1>
        {store && <p className="mt-0.5 text-base font-semibold text-primary">{store.name}</p>}
        <p className="mt-2 text-base text-muted-foreground">{t.closedText}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="opening-float" className="text-base">{t.openingFloat}</Label>
        <MoneyInput id="opening-float" value={float} onChange={setFloat} suffix={org.currency} className="h-14 text-2xl" autoFocus />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={open.isPending}>
        {open.isPending && <Loader2 className="animate-spin" />} {t.open}
      </Button>
    </form>
  )
}
