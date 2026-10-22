import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentOrg } from '@/features/organization/context'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useUpdateOrganization } from '../api'
import { organizationInfoSchema, type OrganizationInfo, type OrganizationInfoInput } from '../schema'

export function OrganizationSettings() {
  const { org } = useCurrentOrg()
  const update = useUpdateOrganization(org.id)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<OrganizationInfoInput, unknown, OrganizationInfo>({
    resolver: zodResolver(organizationInfoSchema),
    values: { name: org.name, phone: org.phone ?? '', address: org.address ?? '' },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => toast.success(fr.app.saved),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  )

  const t = fr.settings
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormField id="org-name" label={t.orgName} error={errors.name?.message}>
        <Input id="org-name" {...register('name')} />
      </FormField>
      <FormField id="org-phone" label={t.phone} error={errors.phone?.message}>
        <Input id="org-phone" type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
      </FormField>
      <FormField id="org-address" label={t.address} error={errors.address?.message}>
        <Input id="org-address" autoComplete="street-address" {...register('address')} />
      </FormField>
      <Button type="submit" size="lg" disabled={!isDirty || update.isPending}>{fr.app.save}</Button>
    </form>
  )
}
