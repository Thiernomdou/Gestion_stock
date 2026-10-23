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
      categories: {
        Row: {
          id: string
          organization_id: string
          parent_id: string | null
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          parent_id?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          parent_id?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          organization_id: string
          category_id: string | null
          sku: string | null
          barcode: string | null
          name: string
          description: string | null
          brand: string | null
          unit: string
          allow_decimal_qty: boolean
          sale_price: number
          wholesale_price: number | null
          min_stock: number
          photo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category_id?: string | null
          sku?: string | null
          barcode?: string | null
          name: string
          description?: string | null
          brand?: string | null
          unit?: string
          allow_decimal_qty?: boolean
          sale_price?: number
          wholesale_price?: number | null
          min_stock?: number
          photo_url?: string | null
          is_active?: boolean
        }
        Update: {
          category_id?: string | null
          sku?: string | null
          barcode?: string | null
          name?: string
          description?: string | null
          brand?: string | null
          unit?: string
          allow_decimal_qty?: boolean
          sale_price?: number
          wholesale_price?: number | null
          min_stock?: number
          photo_url?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          product_id: string
          organization_id: string
          avg_cost: number
          last_cost: number | null
          updated_at: string
        }
        Insert: never
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
      customers: {
        Row: {
          id: string
          organization_id: string
          name: string
          phone: string | null
          customer_type: string
          credit_limit: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          phone?: string | null
          customer_type?: string
          credit_limit?: number | null
          notes?: string | null
        }
        Update: {
          name?: string
          phone?: string | null
          customer_type?: string
          credit_limit?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          id: string
          organization_id: string
          store_id: string
          status: 'open' | 'closed'
          opened_by: string | null
          opened_at: string
          opening_float: number
          closed_by: string | null
          closed_at: string | null
          expected_cash: number | null
          counted_cash: number | null
          difference: number | null
          notes: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          organization_id: string
          store_id: string
          cash_session_id: string | null
          customer_id: string | null
          number: string
          status: Database['public']['Enums']['sale_status']
          subtotal: number
          discount_total: number
          total: number
          paid_amount: number
          balance_due: number
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      product_stock: {
        Row: { organization_id: string; store_id: string; product_id: string; quantity: number }
        Relationships: []
      }
    }
    Functions: {
      set_opening_stock: {
        Args: { p_org: string; p_store: string; p_product: string; p_qty: number; p_unit_cost: number | null }
        Returns: undefined
      }
      import_products: {
        Args: { p_org: string; p_store: string; p_rows: Json }
        Returns: Json
      }
      create_organization: {
        Args: { p_name: string; p_slug: string; p_store_name?: string }
        Returns: string
      }
      accept_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      open_cash_session: {
        Args: { p_org: string; p_store: string; p_opening_float?: number }
        Returns: string
      }
      close_cash_session: {
        Args: { p_session: string; p_counted_cash: number; p_notes?: string | null }
        Returns: Database['public']['Tables']['cash_sessions']['Row']
      }
      cash_session_summary: {
        Args: { p_session: string }
        Returns: Json
      }
      create_sale: {
        Args: { p: Json }
        Returns: string
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
