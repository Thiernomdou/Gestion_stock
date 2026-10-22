import { Navigate, useSearchParams } from 'react-router-dom'
import { useCurrentOrg } from '@/features/organization/context'
import { fr } from '@/lib/i18n/fr'
import { can, type Permission } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { MembersSettings } from './MembersSettings'
import { OrganizationSettings } from './OrganizationSettings'
import { StoresSettings } from './StoresSettings'

const TABS = [
  { key: 'organisation', label: fr.settings.tabs.organization, permission: 'manage_organization', Component: OrganizationSettings },
  { key: 'boutiques', label: fr.settings.tabs.stores, permission: 'manage_stores', Component: StoresSettings },
  { key: 'utilisateurs', label: fr.settings.tabs.members, permission: 'manage_users', Component: MembersSettings },
] as const satisfies ReadonlyArray<{ key: string; label: string; permission: Permission; Component: () => React.JSX.Element }>

export function SettingsPage() {
  const { role } = useCurrentOrg()
  const [params, setParams] = useSearchParams()
  const tabs = TABS.filter((tab) => can(role, tab.permission))
  const active = tabs.find((tab) => tab.key === params.get('onglet')) ?? tabs[0]

  if (!active) return <Navigate to="/" replace />

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">{fr.settings.title}</h1>
      {tabs.length > 1 && (
        <div role="tablist" className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={tab.key === active.key}
              onClick={() => setParams({ onglet: tab.key }, { replace: true })}
              className={cn(
                'h-11 rounded-md px-2 text-sm font-semibold sm:text-base',
                tab.key === active.key ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <active.Component />
    </div>
  )
}
