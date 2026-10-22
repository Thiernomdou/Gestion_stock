import { z } from 'zod'
import { fr } from '@/lib/i18n/fr'

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(fr.errors.invalidEmail)),
  password: z.string().min(8, fr.errors.weakPassword),
})

export type Credentials = z.infer<typeof credentialsSchema>

export const signupSchema = credentialsSchema
  .extend({ passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    message: fr.errors.passwordMismatch,
    path: ['passwordConfirm'],
  })

/** Champs du formulaire de connexion / inscription (la confirmation n'existe qu'à l'inscription). */
export type AuthFormValues = Credentials & { passwordConfirm?: string }
