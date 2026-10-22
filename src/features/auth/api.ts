import { queryClient } from '@/app/query-client'
import { useOrgSelection } from '@/features/organization/store'
import { supabase } from '@/lib/supabase'
import type { Credentials } from './schema'

export async function signIn({ email, password }: Credentials) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Renvoie true si une confirmation par e-mail est nécessaire avant de se connecter. */
export async function signUp({ email, password }: Credentials): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
  return data.session === null
}

export async function signOut() {
  await supabase.auth.signOut()
  queryClient.clear()
  useOrgSelection.getState().reset()
}
