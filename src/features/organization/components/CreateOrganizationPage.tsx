import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2, LogOut, Store } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from '@/components/auth-shell'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/store'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useCreateOrganization } from '../api'
import { createOrganizationSchema, type CreateOrganizationInput } from '../schema'

export function CreateOrganizationPage() {
  const email = useAuth((s) => s.session?.user.email ?? '')
  const navigate = useNavigate()
  const create = useCreateOrganization()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', storeName: 'Boutique principale' },
  })

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, { onSuccess: () => navigate('/', { replace: true }) }),
  )

  const t = fr.onboarding
  return (
    <AuthShell>
      <div className="grid gap-4">
        <div className="rounded-[2rem] bg-card p-5 shadow-raised ring-1 ring-foreground/5 sm:p-8">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary"><Store className="size-7" aria-hidden /></span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t.text}</p>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
            <FormField id="name" label={t.orgName} error={errors.name?.message}>
              <Input id="name" placeholder={t.orgNamePlaceholder} autoComplete="organization" className="h-12" {...register('name')} />
            </FormField>
            <FormField id="storeName" label={t.storeName} error={errors.storeName?.message}>
              <Input id="storeName" className="h-12" {...register('storeName')} />
            </FormField>
            {create.error && <p role="alert" className="rounded-2xl bg-destructive-soft p-3.5 text-base font-semibold text-destructive">{errorMessage(create.error)}</p>}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />} {t.submit}
            </Button>
          </form>
        </div>

        <p className="flex gap-3 rounded-2xl bg-accent/70 p-4 text-base text-accent-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {t.invitedHint}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
          <span className="min-w-0 truncate">{t.signedInAs(email)}</span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut /> {fr.auth.logout}</Button>
        </div>
      </div>
    </AuthShell>
  )
}
