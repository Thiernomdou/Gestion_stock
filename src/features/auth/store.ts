import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  /** false tant que la session stockée n'a pas été relue (évite un flash de l'écran de connexion). */
  ready: boolean
}

export const useAuth = create<AuthState>(() => ({ session: null, ready: false }))

/** À appeler une fois au démarrage ; renvoie la fonction de désabonnement. */
export function initAuth(): () => void {
  void supabase.auth.getSession().then(({ data }) => useAuth.setState({ session: data.session, ready: true }))
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ session, ready: true })
  })
  return () => data.subscription.unsubscribe()
}
