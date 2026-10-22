import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orgKeys } from '@/features/organization/api'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { Invitation, OrganizationInfo } from './schema'

type MemberUpdate = Database['public']['Tables']['organization_members']['Update']
type StoreUpdate = Database['public']['Tables']['stores']['Update']

export const settingsKeys = {
  members: (orgId: string) => ['members', orgId] as const,
  invitations: (orgId: string) => ['invitations', orgId] as const,
}

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: OrganizationInfo) => {
      const { error } = await supabase.from('organizations').update(values).eq('id', orgId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberships'] }),
  })
}

export function useCreateStore(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('stores').insert({ organization_id: orgId, name })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.stores(orgId) }),
  })
}

export function useUpdateStore(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: StoreUpdate & { id: string }) => {
      const { error } = await supabase.from('stores').update(values).eq('id', id).eq('organization_id', orgId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.stores(orgId) }),
  })
}

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: settingsKeys.members(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members').select('*').eq('organization_id', orgId).order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useUpdateMember(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, ...values }: MemberUpdate & { userId: string }) => {
      const { error } = await supabase
        .from('organization_members').update(values).eq('organization_id', orgId).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.members(orgId) }),
  })
}

export function useInvitations(orgId: string) {
  return useQuery({
    queryKey: settingsKeys.invitations(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_invitations').select('*')
        .eq('organization_id', orgId).is('accepted_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useInvite(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Invitation) => {
      const { error } = await supabase.from('organization_invitations').insert({ organization_id: orgId, ...values })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.invitations(orgId) }),
  })
}

export function useCancelInvitation(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('organization_invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.invitations(orgId) }),
  })
}
