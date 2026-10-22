import { createContext, useContext } from 'react'
import type { MemberRole } from '@/lib/database.types'
import type { Membership, Organization, Store } from './api'
import type { OrgSettings } from './schema'

export interface CurrentOrg {
  org: Organization
  role: MemberRole
  settings: OrgSettings
  memberships: Membership[]
  stores: Store[]            // toutes, y compris désactivées (paramètres)
  activeStores: Store[]
  store: Store | null        // boutique en cours sur cet appareil
  setOrg: (orgId: string) => void
  setStore: (storeId: string) => void
}

export const CurrentOrgContext = createContext<CurrentOrg | null>(null)

/** Organisation, rôle et boutique en cours. Disponible sous <OrgGate>. */
export function useCurrentOrg(): CurrentOrg {
  const value = useContext(CurrentOrgContext)
  if (!value) throw new Error('useCurrentOrg doit être utilisé sous <OrgGate>')
  return value
}
