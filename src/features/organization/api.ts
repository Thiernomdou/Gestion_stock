import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/store'
import type { MemberRole, Tables } from '@/lib/database.types'
import { slugify } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import type { CreateOrganizationInput } from './schema'
import { useOrgSelection } from './store'

export type Organization = Tables<'organizations'>
export type Store = Tables<'stores'>

export interface Membership {
  role: MemberRole
  display_name: string | null
  organization: Organization
}

export const orgKeys = {
  memberships: (userId: string | undefined) => ['memberships', userId] as const,
  stores: (orgId: string | undefined) => ['stores', orgId] as const,
}

async function fetchMemberships(userId: string): Promise<Membership[]> {
  // Rattache d'abord l'utilisateur aux organisations qui l'ont invité.
  const { error: inviteError } = await supabase.rpc('accept_invitations')
  if (inviteError) console.warn('accept_invitations', inviteError.message)

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, display_name, organization:organizations(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw error
  return data.flatMap((m) => (m.organization ? [{ ...m, organization: m.organization }] : []))
}

export function useMemberships() {
  const userId = useAuth((s) => s.session?.user.id)
  return useQuery({
    queryKey: orgKeys.memberships(userId),
    queryFn: () => fetchMemberships(userId!),
    enabled: Boolean(userId),
  })
}

export function useStores(orgId: string | undefined) {
  return useQuery({
    queryKey: orgKeys.stores(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores').select('*').eq('organization_id', orgId!).order('created_at')
      if (error) throw error
      return data
    },
    enabled: Boolean(orgId),
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  const setOrg = useOrgSelection((s) => s.setOrg)
  return useMutation({
    mutationFn: async ({ name, storeName }: CreateOrganizationInput) => {
      // Suffixe aléatoire : deux commerces peuvent porter le même nom.
      const slug = `${slugify(name) || 'org'}-${crypto.randomUUID().slice(0, 6)}`
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: name,
        p_slug: slug,
        ...(storeName ? { p_store_name: storeName } : {}),
      })
      if (error) throw error
      return data
    },
    onSuccess: async (orgId) => {
      setOrg(orgId)
      await queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })
}
