import { useLiveQuery } from 'dexie-react-hooks'
import { CloudOff, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { db } from '@/lib/db'
import { fr } from '@/lib/i18n/fr'

/** Badge « Hors ligne » + nombre d'opérations en attente dans l'outbox (CLAUDE.md §6). */
export function NetworkStatus() {
  const online = useOnlineStatus()
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)

  if (online && pending === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!online && (
        <Badge variant="destructive" className="h-7 gap-1 px-2 text-sm">
          <CloudOff aria-hidden /> {fr.network.offline}
        </Badge>
      )}
      {pending > 0 && (
        <Badge variant="secondary" className="h-7 gap-1 px-2 text-sm">
          <RefreshCw aria-hidden /> {fr.network.pending(pending)}
        </Badge>
      )}
    </div>
  )
}
