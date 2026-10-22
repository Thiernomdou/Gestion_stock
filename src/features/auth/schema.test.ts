import { describe, expect, it } from 'vitest'
import { fr } from '@/lib/i18n/fr'
import { signupSchema } from './schema'

describe('signupSchema', () => {
  it('accepte deux mots de passe identiques', () => {
    const r = signupSchema.safeParse({ email: ' Moussa@Test.gn ', password: 'secret123', passwordConfirm: 'secret123' })
    expect(r.success).toBe(true)
    expect(r.data?.email).toBe('moussa@test.gn')
  })
  it('refuse une confirmation différente, sur le champ de confirmation', () => {
    const r = signupSchema.safeParse({ email: 'a@b.gn', password: 'secret123', passwordConfirm: 'secret124' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['passwordConfirm'])
    expect(r.error?.issues[0]?.message).toBe(fr.errors.passwordMismatch)
  })
})
