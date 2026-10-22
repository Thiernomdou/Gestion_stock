import { Building2, type LucideIcon, Store, Users } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { useCurrentOrg } from '@/features/organization/context'
import { fr } from '@/lib/i18n/fr'
import { can, type Permission } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { MembersSettings } from './MembersSettings'
import { OrganizationSettings } from './OrganizationSettings'
import { StoresSettings } from './StoresSettings'

const TABS = [
  { key: 'organisation', label: fr.settings.tabs.organization, icon: Building2, permission: 'manage_organization', Component: OrganizationSettings },
  { key: 'boutiques', label: fr.settings.tabs.stores, icon: Store, permission: 'manage_stores', Component: StoresSettings },
  { key: 'utilisateurs', label: fr.settings.tabs.members, icon: Users, permission: 'manage_users', Component: MembersSettings },
] as const satisfies ReadonlyArray<{ key: string; label: string; icon: LucideIcon; permission: Permission; Component: () => React.JSX.Element }>

export function SettingsPage() {
  const { role } = useCurrentOrg()
  const [params, setParams] = useSearchParams()
  const tabs = TABS.filter((tab) => can(role, tab.permission))
  const active = tabs.find((tab) => tab.key === params.get('onglet')) ?? tabs[0]

  if (!active) return <Navigate to="/" replace />

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5">
      <PageHeader title={fr.settings.title} description={fr.settings.description} />
      {tabs.length > 1 && (
        <div role="tablist" className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1 surface">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={tab.key === active.key}
              onClick={() => setParams({ onglet: tab.key }, { replace: true })}
              className={cn(
                'flex h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors sm:text-base',
                tab.key === active.key ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <tab.icon className="hidden size-5 min-[400px]:block" aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div key={active.key} className="animate-rise">
        <active.Component />
      </div>
    </div>
  )
}
