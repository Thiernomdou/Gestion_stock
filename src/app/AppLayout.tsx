import { Check, ChevronDown, LogOut, Store as StoreIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { NetworkStatus } from '@/components/network-status'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/store'
import { useCurrentOrg } from '@/features/organization/context'
import { initials } from '@/lib/format'
import { fr } from '@/lib/i18n/fr'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav'

function OrgMark({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-xl bg-linear-to-b from-ink-2 to-ink font-bold tracking-tight text-white shadow-primary', className)}>
      {initials(name)}
    </span>
  )
}

export function AppLayout() {
  const { org, role, memberships, activeStores, store, setOrg, setStore } = useCurrentOrg()
  const email = useAuth((s) => s.session?.user.email)
  const items = NAV_ITEMS.filter((item) => !item.permission || item.permission.some((p) => can(role, p)))

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:shadow-raised">
        {fr.app.skipToContent}
      </a>

      <header className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-background/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          {/* Organisation + compte */}
          <DropdownMenu>
            <DropdownMenuTrigger className="-ml-1.5 flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pr-2.5 pl-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted">
              <OrgMark name={org.name} className="size-10 text-sm" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-base leading-tight font-bold">
                  <span className="truncate">{org.name}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </span>
                <span className="block truncate text-sm text-muted-foreground">{fr.roles[role]}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
              {memberships.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{fr.nav.switchOrg}</DropdownMenuLabel>
                  {memberships.map((m) => (
                    <DropdownMenuItem key={m.organization.id} onSelect={() => setOrg(m.organization.id)} className="h-11 gap-2.5 text-base">
                      <OrgMark name={m.organization.name} className="size-7 rounded-lg text-[0.65rem] shadow-none" />
                      <span className="flex-1 truncate">{m.organization.name}</span>
                      {m.organization.id === org.id && <Check className="size-4 text-primary" aria-hidden />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()} className="h-11 gap-2.5 text-base">
                <LogOut className="size-5" aria-hidden /> {fr.auth.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Navigation grand écran */}
          <nav aria-label="Navigation principale" className="ml-2 hidden items-center gap-1 rounded-2xl surface p-1 md:flex">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn(
                  'flex h-10 items-center gap-2 rounded-xl px-4 text-[0.95rem] font-semibold transition-colors',
                  isActive ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-[1.15rem]" aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NetworkStatus />
            {activeStores.length > 1 ? (
              <Select value={store?.id ?? ''} onValueChange={setStore}>
                <SelectTrigger className="h-11 max-w-48 gap-1.5 rounded-2xl border-transparent font-semibold surface" aria-label={fr.layout.store}>
                  <StoreIcon className="text-primary" aria-hidden /> <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {activeStores.map((s) => <SelectItem key={s.id} value={s.id} className="text-base">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : store ? (
              <span className="hidden h-10 items-center gap-1.5 rounded-2xl px-3.5 text-sm font-semibold text-muted-foreground surface sm:flex">
                <StoreIcon className="size-4 text-primary" aria-hidden /> {store.name}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 md:pt-8 md:pb-14">
        <Outlet />
      </main>

      {/* Barre d'onglets téléphone : flottante, au-dessus de la barre gestuelle */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-[1.75rem] bg-card/98 p-1.5 shadow-raised ring-1 ring-foreground/5 md:hidden"
      >
        <div className="grid auto-cols-fr grid-flow-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] text-xs font-semibold transition-colors',
                isActive ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground active:bg-muted',
              )}
            >
              <Icon className="size-[1.4rem]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
