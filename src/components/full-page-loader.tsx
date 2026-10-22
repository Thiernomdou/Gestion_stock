import { Loader2 } from 'lucide-react'
import { fr } from '@/lib/i18n/fr'

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-lg text-muted-foreground" role="status">
      <Loader2 className="size-6 animate-spin" aria-hidden /> {fr.app.loading}
    </div>
  )
}
