import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, UserPlus, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/store'
import { useCurrentOrg } from '@/features/organization/context'
import type { MemberRole } from '@/lib/database.types'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useCancelInvitation, useInvitations, useInvite, useMembers, useUpdateMember } from '../api'
import { invitationSchema, memberRoles, type Invitation, type InvitationInput } from '../schema'

const t = fr.settings
const onError = (e: unknown) => toast.error(errorMessage(e))

function RoleSelect({ id, value, onChange, disabled }: {
  id?: string; value: MemberRole; onChange: (role: MemberRole) => void; disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MemberRole)} disabled={disabled ?? false}>
      <SelectTrigger id={id} className="w-full sm:w-44" aria-label={t.role}><SelectValue /></SelectTrigger>
      <SelectContent>
        {memberRoles.map((role) => <SelectItem key={role} value={role} className="text-base">{fr.roles[role]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function MembersSettings() {
  const { org } = useCurrentOrg()
  const userId = useAuth((s) => s.session?.user.id)
  const members = useMembers(org.id)
  const invitations = useInvitations(org.id)
  const updateMember = useUpdateMember(org.id)
  const cancelInvitation = useCancelInvitation(org.id)

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t.members}</h2>
        {members.error && <p className="text-destructive">{errorMessage(members.error)}</p>}
        <ul className="grid gap-2">
          {members.data?.map((m) => {
            const name = m.display_name ?? m.user_id.slice(0, 8)
            const isMe = m.user_id === userId
            return (
              <li key={m.user_id} className="grid gap-2 rounded-lg border p-3 sm:flex sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">
                    {name} {isMe && <span className="text-muted-foreground">({t.you})</span>}
                  </p>
                  {!m.is_active && <Badge variant="secondary">{t.inactive}</Badge>}
                </div>
                <div className="flex gap-2">
                  <RoleSelect value={m.role} disabled={!m.is_active}
                              onChange={(role) => updateMember.mutate({ userId: m.user_id, role }, { onError })} />
                  {!isMe && (m.is_active ? (
                    <ConfirmDialog
                      trigger={<Button variant="outline">{t.deactivate}</Button>}
                      title={t.deactivate}
                      description={t.deactivateMemberConfirm(name)}
                      destructive
                      onConfirm={() => updateMember.mutate({ userId: m.user_id, is_active: false }, { onError })}
                    />
                  ) : (
                    <Button variant="outline" onClick={() => updateMember.mutate({ userId: m.user_id, is_active: true }, { onError })}>
                      {t.activate}
                    </Button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {invitations.data && invitations.data.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t.pendingInvitations}</h2>
          <ul className="grid gap-2">
            {invitations.data.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 rounded-lg border border-dashed p-3">
                <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{inv.display_name ?? inv.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{inv.email} · {fr.roles[inv.role]}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={t.cancelInvitation}
                        onClick={() => cancelInvitation.mutate(inv.id, { onError })}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <InviteForm />
    </div>
  )
}

function InviteForm() {
  const { org } = useCurrentOrg()
  const invite = useInvite(org.id)
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<InvitationInput, unknown, Invitation>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '', display_name: '', role: 'cashier' },
  })

  const onSubmit = handleSubmit((values) =>
    invite.mutate(values, {
      onSuccess: () => { toast.success(t.invited); reset() },
      onError,
    }),
  )

  return (
    <section className="grid gap-3 rounded-lg bg-muted/60 p-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="size-5" aria-hidden /> {t.invite}</h2>
      <p className="text-sm text-muted-foreground">{t.inviteHint}</p>
      <form onSubmit={onSubmit} className="grid gap-3" noValidate>
        <FormField id="invite-email" label={fr.auth.email} error={errors.email?.message}>
          <Input id="invite-email" type="email" inputMode="email" className="bg-background" {...register('email')} />
        </FormField>
        <FormField id="invite-name" label={t.displayName} error={errors.display_name?.message}>
          <Input id="invite-name" className="bg-background" {...register('display_name')} />
        </FormField>
        <FormField id="invite-role" label={t.role}>
          <Controller control={control} name="role"
                      render={({ field }) => <RoleSelect id="invite-role" value={field.value} onChange={field.onChange} />} />
        </FormField>
        <Button type="submit" size="lg" disabled={invite.isPending}>{t.invite}</Button>
      </form>
    </section>
  )
}
