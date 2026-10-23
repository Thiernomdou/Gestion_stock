import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productKeys } from '@/features/products/api'
import type { Database, Json, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { CartLine, PaymentLine } from './cart'

export type CashSession = Tables<'cash_sessions'>
export type Customer = Tables<'customers'>
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export const posKeys = {
  openSession: (storeId: string) => ['cash-session', 'open', storeId] as const,
  summary: (sessionId: string) => ['cash-session', 'summary', sessionId] as const,
  history: (storeId: string) => ['cash-session', 'history', storeId] as const,
  customers: (orgId: string) => ['customers', orgId] as const,
}

/** Caisse ouverte de la boutique (null si fermée). */
export function useOpenSession(storeId: string | undefined) {
  return useQuery({
    queryKey: posKeys.openSession(storeId ?? ''),
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions').select('*').eq('store_id', storeId!).eq('status', 'open').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useOpenCashSession(orgId: string, storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (openingFloat: number) => {
      const { data, error } = await supabase.rpc('open_cash_session', { p_org: orgId, p_store: storeId, p_opening_float: openingFloat })
      if (error) throw error
      return data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cash-session'] }),
  })
}

export function useCloseCashSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, counted, notes }: { sessionId: string; counted: number; notes: string }) => {
      const { data, error } = await supabase.rpc('close_cash_session', { p_session: sessionId, p_counted_cash: counted, p_notes: notes })
      if (error) throw error
      return data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cash-session'] }),
  })
}

export interface PaymentBreakdown { method: string; sales: number; repayments: number; refunds: number; net: number }

/** Résumé calculé par le serveur (cash_session_summary) : écran de clôture et rapport Z. */
export interface SessionSummary {
  session: CashSession
  store_name: string
  opened_by_name: string | null
  closed_by_name: string | null
  sales_count: number
  sales_total: number
  discounts: number
  credit_given: number
  cancelled_count: number
  payments: PaymentBreakdown[]
  expenses_cash: number
  expected_cash: number
}

export function useSessionSummary(sessionId: string | undefined) {
  return useQuery({
    queryKey: posKeys.summary(sessionId ?? ''),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cash_session_summary', { p_session: sessionId! })
      if (error) throw error
      // Les montants bigint arrivent parfois en chaîne : on les convertit une fois ici.
      const s = data as unknown as SessionSummary
      const n = (v: unknown) => Number(v ?? 0)
      return {
        ...s,
        sales_count: n(s.sales_count), sales_total: n(s.sales_total), discounts: n(s.discounts),
        credit_given: n(s.credit_given), cancelled_count: n(s.cancelled_count), expenses_cash: n(s.expenses_cash),
        expected_cash: n(s.expected_cash),
        payments: s.payments.map((p) => ({ method: p.method, sales: n(p.sales), repayments: n(p.repayments), refunds: n(p.refunds), net: n(p.net) })),
      } satisfies SessionSummary
    },
  })
}

/** Dernières journées clôturées de la boutique, avec leur écart. */
export function useCashHistory(storeId: string | undefined) {
  return useQuery({
    queryKey: posKeys.history(storeId ?? ''),
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions').select('*').eq('store_id', storeId!).eq('status', 'closed')
        .order('closed_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
  })
}

export function useCustomers(orgId: string) {
  return useQuery({
    queryKey: posKeys.customers(orgId),
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').eq('organization_id', orgId).order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateCustomer(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<CustomerInsert, 'organization_id'>) => {
      const id = values.id ?? crypto.randomUUID()
      const { error } = await supabase.from('customers').insert({ ...values, id, organization_id: orgId })
      if (error) throw error
      return id
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: posKeys.customers(orgId) }),
  })
}

export interface SaleInput {
  id: string
  storeId: string
  sessionId: string | null
  customerId: string | null
  lines: CartLine[]
  globalDiscount: number
  payments: PaymentLine[]
}

/** Vente enregistrée par la RPC create_sale (idempotente) ; renvoie le numéro définitif. */
export function useCreateSale(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (s: SaleInput) => {
      const payload = {
        id: s.id,
        organization_id: orgId,
        store_id: s.storeId,
        cash_session_id: s.sessionId,
        customer_id: s.customerId,
        created_at: new Date().toISOString(),
        global_discount: s.globalDiscount,
        items: s.lines.map((l) => ({ id: l.id, product_id: l.productId, quantity: l.quantity, unit_price: l.unitPrice, discount: l.discount })),
        payments: s.payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null })),
      }
      const { error } = await supabase.rpc('create_sale', { p: payload as unknown as Json })
      if (error) throw error
      const { data, error: readError } = await supabase.from('sales').select('number, created_at').eq('id', s.id).single()
      if (readError) throw readError
      return data
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.stock(orgId) }),
      queryClient.invalidateQueries({ queryKey: ['cash-session'] }),
    ]),
  })
}
