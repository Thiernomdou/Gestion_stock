// ⚠️ Sous-ensemble écrit à la main en attendant le projet Supabase.
// Dès que la migration est appliquée, remplacer ce fichier par :
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
// (puis ré-exporter MemberRole : export type MemberRole = Database['public']['Enums']['member_role'])

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type MemberRole = 'owner' | 'manager' | 'cashier' | 'storekeeper'

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          currency: string
          timezone: string
          country: string
          phone: string | null
          address: string | null
          logo_url: string | null
          settings: Json
          plan: string
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          name?: string
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          settings?: Json
          currency?: string
          timezone?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: MemberRole
          display_name: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          role?: MemberRole
          display_name?: string | null
          is_active?: boolean
        }
        Update: {
          role?: MemberRole
          display_name?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organization_invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: MemberRole
          display_name: string | null
          invited_by: string | null
          created_at: string
          accepted_at: string | null
          accepted_by: string | null
        }
        Insert: {
          organization_id: string
          email: string
          role?: MemberRole
          display_name?: string | null
        }
        Update: never
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          organization_id: string
          name: string
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          address?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          address?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_store_name?: string }
        Returns: string
      }
      accept_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      member_role: MemberRole
      movement_type:
        | 'opening' | 'purchase' | 'sale' | 'sale_cancel' | 'customer_return'
        | 'adjustment' | 'loss' | 'transfer_in' | 'transfer_out'
      sale_status: 'completed' | 'cancelled'
      purchase_status: 'draft' | 'ordered' | 'received' | 'cancelled'
      payment_kind: 'sale' | 'credit_repayment' | 'refund'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
