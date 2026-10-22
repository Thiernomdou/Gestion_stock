import { useMemo } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { FullPageLoader } from '@/components/full-page-loader'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { fr } from '@/lib/i18n/fr'
import { useMemberships, useStores } from '../api'
import { CurrentOrgContext, type CurrentOrg } from '../context'
import { parseSettings } from '../schema'
import { useOrgSelection } from '../store'

/** Charge les organisations de l'utilisateur ; sans organisation, envoie vers la création. */
export function OrgGate() {
  const memberships = useMemberships()
  const { orgId, storeId, setOrg, setStore } = useOrgSelection()

  const membership = memberships.data?.find((m) => m.organization.id === orgId) ?? memberships.data?.[0]
  const stores = useStores(membership?.organization.id)

  const value = useMemo<CurrentOrg | null>(() => {
    if (!membership || !memberships.data) return null
    const all = stores.data ?? []
    const activeStores = all.filter((s) => s.is_active)
    return {
      org: membership.organization,
      role: membership.role,
      settings: parseSettings(membership.organization.settings),
      memberships: memberships.data,
      stores: all,
      activeStores,
      store: activeStores.find((s) => s.id === storeId) ?? activeStores[0] ?? null,
      setOrg,
      setStore,
    }
  }, [membership, memberships.data, stores.data, storeId, setOrg, setStore])

  if (memberships.isPending || (membership && stores.isPending)) return <FullPageLoader />

  const error = memberships.error ?? stores.error
  if (error) {
    // TODO (phase 1, étape 7) : garder ces données dans Dexie pour démarrer sans réseau.
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-lg font-medium">{errorMessage(error)}</p>
        <Button size="lg" onClick={() => void memberships.refetch()}>{fr.app.retry}</Button>
      </div>
    )
  }

  if (!value) return <Navigate to="/demarrer" replace />

  return (
    <CurrentOrgContext.Provider value={value}>
      <Outlet />
    </CurrentOrgContext.Provider>
  )
}

