import { BrandMark } from '@/components/brand-mark'
import { fr } from '@/lib/i18n/fr'

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4" role="status">
      <BrandMark className="size-14 animate-pulse" />
      <span className="text-base font-medium text-muted-foreground">{fr.app.loading}</span>
    </div>
  )
}
