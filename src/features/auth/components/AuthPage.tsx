import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck, Store } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { signIn, signUp } from '../api'
import { credentialsSchema, signupSchema, type AuthFormValues } from '../schema'
import { useAuth } from '../store'

/** Écran de connexion (mode="login") ou d'inscription (mode="signup"). */
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const session = useAuth((s) => s.session)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthFormValues>({
    resolver: zodResolver(mode === 'signup' ? signupSchema : credentialsSchema),
  })

  if (session) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      if (mode === 'login') await signIn({ email, password })
      else if (await signUp({ email, password })) setConfirmEmail(email)
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  const t = fr.auth
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-4">
      <div className="flex items-center justify-center gap-2 text-primary">
        <Store className="size-8" aria-hidden />
        <span className="text-2xl font-bold">{fr.app.name}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {confirmEmail ? t.checkEmailTitle : mode === 'login' ? t.loginTitle : t.signupTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confirmEmail ? (
            <div className="grid gap-4">
              <MailCheck className="size-12 text-primary" aria-hidden />
              <p className="text-base">{t.checkEmailText(confirmEmail)}</p>
              <Button asChild size="lg"><Link to="/connexion">{t.login}</Link></Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <FormField id="email" label={t.email} error={errors.email?.message}>
                <Input id="email" type="email" inputMode="email" autoComplete="email" {...register('email')} />
              </FormField>
              <FormField id="password" label={t.password} error={errors.password?.message}
                         hint={mode === 'signup' ? t.passwordHint : undefined}>
                <Input id="password" type="password"
                       autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} />
              </FormField>
              {mode === 'signup' && (
                <FormField id="passwordConfirm" label={t.passwordConfirm} error={errors.passwordConfirm?.message}>
                  <Input id="passwordConfirm" type="password" autoComplete="new-password" {...register('passwordConfirm')} />
                </FormField>
              )}
              {serverError && <p role="alert" className="text-base font-medium text-destructive">{serverError}</p>}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {mode === 'login' ? t.login : t.signup}
              </Button>
              <p className="text-center text-base">
                {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                <Link className="font-semibold text-primary underline" to={mode === 'login' ? '/inscription' : '/connexion'}>
                  {mode === 'login' ? t.signup : t.login}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
