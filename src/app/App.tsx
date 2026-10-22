import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { initAuth } from '@/features/auth/store'
import { fr } from '@/lib/i18n/fr'
import { isSupabaseConfigured } from '@/lib/supabase'
import { queryClient } from './query-client'
import { router } from './router'

export function App() {
  useEffect(() => (isSupabaseConfigured ? initAuth() : undefined), [])

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto grid min-h-svh max-w-md content-center gap-3 p-4">
        <h1 className="text-xl font-bold">{fr.app.notConfiguredTitle}</h1>
        <p className="text-base">{fr.app.notConfiguredText}</p>
      </main>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
