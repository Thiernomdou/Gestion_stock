import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Store as StoreIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Store } from '@/features/organization/api'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useCreateStore, useUpdateStore } from '../api'
import { storeSchema, type StoreInput } from '../schema'

const t = fr.settings

export function StoresSettings() {
  const { org, stores } = useCurrentOrg()
  const update = useUpdateStore(org.id)
  const [editing, setEditing] = useState<Store | 'new' | null>(null)

  const toggle = (store: Store) =>
    update.mutate({ id: store.id, is_active: !store.is_active }, { onError: (e) => toast.error(errorMessage(e)) })

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {stores.map((store) => (
          <li key={store.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <StoreIcon className="size-5 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base font-medium">{store.name}</span>
            {!store.is_active && <Badge variant="secondary">{t.inactive}</Badge>}
            <Button variant="outline" size="icon" aria-label={`${t.rename} ${store.name}`} onClick={() => setEditing(store)}>
              <Pencil />
            </Button>
            {store.is_active ? (
              <ConfirmDialog
                trigger={<Button variant="outline">{t.deactivate}</Button>}
                title={t.deactivate}
                description={t.deactivateStoreConfirm(store.name)}
                destructive
                onConfirm={() => toggle(store)}
              />
            ) : (
              <Button variant="outline" onClick={() => toggle(store)}>{t.activate}</Button>
            )}
          </li>
        ))}
      </ul>

      <Button size="lg" variant="secondary" onClick={() => setEditing('new')}>
        <Plus /> {t.newStore}
      </Button>

      {editing && <StoreDialog store={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StoreDialog({ store, onClose }: { store: Store | null; onClose: () => void }) {
  const { org } = useCurrentOrg()
  const create = useCreateStore(org.id)
  const update = useUpdateStore(org.id)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StoreInput>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: store?.name ?? '' },
  })

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      if (store) await update.mutateAsync({ id: store.id, name })
      else await create.mutateAsync(name)
      toast.success(fr.app.saved)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store ? t.rename : t.newStore}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="store-name" label={t.storeName} error={errors.name?.message}>
            <Input id="store-name" autoFocus {...register('name')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{fr.app.cancel}</Button>
            <Button type="submit" disabled={isSubmitting}>{fr.app.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
