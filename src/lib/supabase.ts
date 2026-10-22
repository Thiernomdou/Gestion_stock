import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Faux si .env n'est pas rempli : l'application affiche alors un écran d'aide. */
export const isSupabaseConfigured = Boolean(url && key)

// Clé publique uniquement (anon / publishable) : jamais la clé service_role dans le front.
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
