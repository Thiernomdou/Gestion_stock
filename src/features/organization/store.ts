import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Organisation et boutique choisies sur cet appareil (mémorisées entre deux ouvertures).
interface OrgSelection {
  orgId: string | null
  storeId: string | null
  setOrg: (orgId: string) => void
  setStore: (storeId: string) => void
  reset: () => void
}

export const useOrgSelection = create<OrgSelection>()(
  persist(
    (set) => ({
      orgId: null,
      storeId: null,
      setOrg: (orgId) => set({ orgId, storeId: null }),
      setStore: (storeId) => set({ storeId }),
      reset: () => set({ orgId: null, storeId: null }),
    }),
    { name: 'org-selection' },
  ),
)
