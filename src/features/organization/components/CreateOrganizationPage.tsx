import { zodResolver } from '@hookform/resolvers/zod'
import { Store } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <Store className="size-10 text-primary" aria-hidden />
          <CardTitle className="text-xl">{t.title}</CardTitle>
          <CardDescription className="text-base">{t.text}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormField id="name" label={t.orgName} error={errors.name?.message}>
              <Input id="name" placeholder={t.orgNamePlaceholder} autoComplete="organization" {...register('name')} />
            </FormField>
            <FormField id="storeName" label={t.storeName} error={errors.storeName?.message}>
              <Input id="storeName" {...register('storeName')} />
            </FormField>
            {create.error && <p role="alert" className="text-base font-medium text-destructive">{errorMessage(create.error)}</p>}
            <Button type="submit" size="lg" disabled={create.isPending}>{t.submit}</Button>
          </form>
        </CardContent>
      </Card>

      <p className="rounded-lg bg-muted p-3 text-base">{t.invitedHint}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{t.signedInAs(email)}</span>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>{fr.auth.logout}</Button>
      </div>
    </main>
  )
}
