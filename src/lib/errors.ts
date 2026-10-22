import { fr } from './i18n/fr'

// Les erreurs des RPC sont déjà en français (raise exception côté SQL).
// Celles de Supabase Auth et du réseau sont en anglais : on les traduit ici.
const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, fr.errors.invalidCredentials],
  [/email not confirmed/i, fr.errors.emailNotConfirmed],
  [/user already registered/i, fr.errors.alreadyRegistered],
  [/password should be at least/i, fr.errors.weakPassword],
  [/rate limit|too many requests/i, fr.errors.rateLimited],
  [/failed to fetch|network|load failed/i, fr.errors.network],
  [/row-level security|permission denied/i, fr.errors.forbidden],
  [/duplicate key value.*organization_invitations/i, fr.errors.invitationExists],
]

export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message
    : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message)
    : String(error)
  for (const [pattern, message] of AUTH_MESSAGES) if (pattern.test(raw)) return message
  return raw || fr.errors.unknown
}
