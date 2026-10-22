import { Home, LogOut, Store as StoreIcon } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { NetworkStatus } from '@/components/network-status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { signOut } from '@/features/auth/api'
import { useCurrentOrg } from '@/features/organization/context'
import { fr } from '@/lib/i18n/fr'

export function AppLayout() {
  const { org, role, memberships, activeStores, store, setOrg, setStore } = useCurrentOrg()
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2">
          {pathname !== '/' && (
            <Button asChild variant="ghost" size="icon" aria-label={fr.layout.home}>
              <Link to="/"><Home /></Link>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            {memberships.length > 1 ? (
              <Select value={org.id} onValueChange={setOrg}>
                <SelectTrigger className="h-9 w-full border-0 px-0 text-lg font-bold shadow-none" aria-label={fr.layout.organization}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.organization.id} value={m.organization.id} className="text-base">
                      {m.organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate text-lg font-bold">{org.name}</p>
            )}
            <p className="text-sm text-muted-foreground">{fr.roles[role]}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={fr.auth.logout} onClick={() => void signOut()}>
            <LogOut />
          </Button>
        </div>

        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 pb-2">
          {activeStores.length > 1 ? (
            <Select value={store?.id ?? ''} onValueChange={setStore}>
              <SelectTrigger className="min-w-0 flex-1 sm:max-w-xs" aria-label={fr.layout.store}>
                <StoreIcon aria-hidden /> <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeStores.map((s) => <SelectItem key={s.id} value={s.id} className="text-base">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : store ? (
            <p className="flex items-center gap-1.5 text-base font-medium">
              <StoreIcon className="size-4 text-muted-foreground" aria-hidden /> {store.name}
            </p>
          ) : null}
          <NetworkStatus />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-3 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
