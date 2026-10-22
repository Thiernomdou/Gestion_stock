import { z } from 'zod'
import { fr } from '@/lib/i18n/fr'

const optionalText = z.string().trim().max(200).transform((v) => (v === '' ? null : v))

export const organizationInfoSchema = z.object({
  name: z.string().trim().min(2, fr.errors.required).max(80),
  phone: optionalText,
  address: optionalText,
})
export type OrganizationInfoInput = z.input<typeof organizationInfoSchema>
export type OrganizationInfo = z.output<typeof organizationInfoSchema>

export const storeSchema = z.object({
  name: z.string().trim().min(1, fr.errors.required).max(80),
})
export type StoreInput = z.infer<typeof storeSchema>

export const memberRoles = ['owner', 'manager', 'cashier', 'storekeeper'] as const

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(fr.errors.invalidEmail)),
  display_name: optionalText,
  role: z.enum(memberRoles),
})
export type InvitationInput = z.input<typeof invitationSchema>
export type Invitation = z.output<typeof invitationSchema>
