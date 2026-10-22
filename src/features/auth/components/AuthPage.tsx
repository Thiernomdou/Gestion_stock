import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { AuthShell } from '@/components/auth-shell'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
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
    <AuthShell>
      <div className="rounded-[2rem] bg-card p-5 shadow-raised ring-1 ring-foreground/5 sm:p-8">
        {confirmEmail ? (
          <div className="grid justify-items-start gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary"><MailCheck className="size-7" aria-hidden /></span>
            <h1 className="text-2xl font-extrabold tracking-tight">{t.checkEmailTitle}</h1>
            <p className="text-base text-muted-foreground">{t.checkEmailText(confirmEmail)}</p>
            <Button asChild size="lg" className="w-full"><Link to="/connexion">{t.login}</Link></Button>
          </div>
        ) : (
          <>
            {/* Onglets Connexion / Inscription */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist">
              {(['login', 'signup'] as const).map((m) => (
                <Link
                  key={m}
                  to={m === 'login' ? '/connexion' : '/inscription'}
                  role="tab"
                  aria-selected={mode === m}
                  replace
                  className={`grid h-11 place-items-center rounded-xl text-base font-semibold transition-colors ${mode === m ? 'bg-card shadow-card' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {m === 'login' ? t.loginTitle : t.signupTitle}
                </Link>
              ))}
            </div>

            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <h1 className="sr-only">{mode === 'login' ? t.loginTitle : t.signupTitle}</h1>
              <FormField id="email" label={t.email} error={errors.email?.message}>
                <Input id="email" type="email" inputMode="email" autoComplete="email" className="h-12" {...register('email')} />
              </FormField>
              <FormField id="password" label={t.password} error={errors.password?.message}
                         hint={mode === 'signup' ? t.passwordHint : undefined}>
                <Input id="password" type="password" className="h-12"
                       autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')} />
              </FormField>
              {mode === 'signup' && (
                <FormField id="passwordConfirm" label={t.passwordConfirm} error={errors.passwordConfirm?.message}>
                  <Input id="passwordConfirm" type="password" autoComplete="new-password" className="h-12" {...register('passwordConfirm')} />
                </FormField>
              )}
              {serverError && <p role="alert" className="rounded-2xl bg-destructive-soft p-3.5 text-base font-semibold text-destructive">{serverError}</p>}
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {mode === 'login' ? t.login : t.signup}
              </Button>
              <p className="text-center text-base text-muted-foreground">
                {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" to={mode === 'login' ? '/inscription' : '/connexion'}>
                  {mode === 'login' ? t.signup : t.login}
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  )
}
