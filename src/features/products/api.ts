import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { ImportRow } from './csv'
import type { ProductFormValues } from './schema'

export type Product = Tables<'products'>
export type Category = Tables<'categories'>

type ProductInsert = Database['public']['Tables']['products']['Insert']

const PHOTO_BUCKET = 'product-photos'

/** URL publique d'une photo (products.photo_url contient le chemin dans le bucket). Aucun appel réseau. */
export function productPhotoUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : null
}

/** Nouvelle photo choisie, photo retirée, ou inchangée (undefined). */
export type PhotoChange = { blob: Blob } | 'remove' | undefined

export const productKeys = {
  products: (orgId: string) => ['products', orgId] as const,
  categories: (orgId: string) => ['categories', orgId] as const,
  stock: (orgId: string) => ['stock', orgId] as const,
  costs: (orgId: string) => ['product-costs', orgId] as const,
}

// PostgREST renvoie au plus 1 000 lignes par requête : on pagine pour charger tout le catalogue.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

/** Tout le catalogue de l'organisation (filtré et recherché côté appareil : rapide, prêt pour le hors ligne). */
export function useProducts(orgId: string) {
  return useQuery({
    queryKey: productKeys.products(orgId),
    queryFn: () =>
      fetchAll<Product>((from, to) =>
        supabase.from('products').select('*').eq('organization_id', orgId).order('name').range(from, to)),
  })
}

export function useCategories(orgId: string) {
  return useQuery({
    queryKey: productKeys.categories(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories').select('*').eq('organization_id', orgId).order('sort_order').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Stock par produit et par boutique : Map<storeId, Map<productId, quantité>>. */
export function useStock(orgId: string) {
  return useQuery({
    queryKey: productKeys.stock(orgId),
    queryFn: async () => {
      const rows = await fetchAll<{ store_id: string; product_id: string; quantity: number }>((from, to) =>
        supabase.from('product_stock').select('store_id, product_id, quantity').eq('organization_id', orgId).range(from, to))
      const byStore = new Map<string, Map<string, number>>()
      for (const r of rows) {
        if (!byStore.has(r.store_id)) byStore.set(r.store_id, new Map())
        byStore.get(r.store_id)!.set(r.product_id, Number(r.quantity))
      }
      return byStore
    },
  })
}

/** Coûts moyens (CMP) : uniquement pour le patron et le gérant (la RLS renvoie 0 ligne aux autres). */
export function useProductCosts(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: productKeys.costs(orgId),
    enabled,
    queryFn: async () => {
      const rows = await fetchAll<{ product_id: string; avg_cost: number }>((from, to) =>
        supabase.from('product_costs').select('product_id, avg_cost').eq('organization_id', orgId).range(from, to))
      return new Map(rows.map((r) => [r.product_id, Number(r.avg_cost)]))
    },
  })
}

function toRow(values: ProductFormValues): Omit<ProductInsert, 'organization_id' | 'id'> {
  return {
    name: values.name,
    category_id: values.category_id,
    brand: values.brand,
    sku: values.sku,
    barcode: values.barcode,
    description: values.description,
    unit: values.unit,
    allow_decimal_qty: values.allow_decimal_qty,
    sale_price: values.sale_price ?? 0,
    wholesale_price: values.wholesale_price,
    min_stock: values.min_stock ?? 0,
    is_active: values.is_active,
  }
}

export function useSaveProduct(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // `id` est généré par le formulaire dès l'ouverture (création comprise) : renvoyer le même
    // formulaire après une erreur met à jour le produit au lieu d'en créer un second.
    mutationFn: async ({ id: productId, isNew, values, storeId, photo, previousPhoto }: {
      id: string; isNew: boolean; values: ProductFormValues; storeId: string | null; photo?: PhotoChange; previousPhoto?: string | null
    }) => {
      // La photo part d'abord : si l'envoi échoue, rien n'est enregistré et l'utilisateur peut réessayer
      // sans créer de doublon. Un fichier orphelin (envoi réussi, produit refusé) est sans conséquence.
      const row: Omit<ProductInsert, 'organization_id' | 'id'> = { ...toRow(values) }
      if (photo === 'remove') row.photo_url = null
      else if (photo) {
        const ext = photo.blob.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${orgId}/${productId}/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, {
          contentType: photo.blob.type, cacheControl: '31536000',
        })
        if (error) throw error
        row.photo_url = path
      }

      if (isNew) {
        const { error } = await supabase.from('products').upsert({ id: productId, organization_id: orgId, ...row })
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').update(row).eq('id', productId).eq('organization_id', orgId)
        if (error) throw error
      }
      // Ancienne photo remplacée ou retirée : on libère la place (sans bloquer si ça échoue).
      if (photo && previousPhoto) void supabase.storage.from(PHOTO_BUCKET).remove([previousPhoto])

      if (storeId && values.opening_qty && values.opening_qty > 0) {
        const { error } = await supabase.rpc('set_opening_stock', {
          p_org: orgId, p_store: storeId, p_product: productId, p_qty: values.opening_qty, p_unit_cost: values.opening_cost,
        })
        if (error) throw error
      }
      return productId
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.products(orgId) }),
      queryClient.invalidateQueries({ queryKey: productKeys.stock(orgId) }),
      queryClient.invalidateQueries({ queryKey: productKeys.costs(orgId) }),
    ]),
  })
}

export function useSaveCategory(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      const { error } = id
        ? await supabase.from('categories').update({ name }).eq('id', id).eq('organization_id', orgId)
        : await supabase.from('categories').insert({ organization_id: orgId, name })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.categories(orgId) }),
  })
}

export function useDeleteCategory(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('categories').delete({ count: 'exact' }).eq('id', id).eq('organization_id', orgId)
      if (error) throw error
      // La RLS ne lève pas d'erreur quand le rôle ne peut pas supprimer : elle ne supprime rien.
      if (count === 0) throw new Error('permission denied')
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.categories(orgId) }),
      queryClient.invalidateQueries({ queryKey: productKeys.products(orgId) }),
    ]),
  })
}

export interface ImportResult {
  created: number
  updated: number
  stock_entries: number
  stock_skipped: number
  categories_created: number
}

export function useImportProducts(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, rows }: { storeId: string; rows: ImportRow[] }) => {
      const payload = rows.map(({ line: _line, ...row }) => row)
      const { data, error } = await supabase.rpc('import_products', { p_org: orgId, p_store: storeId, p_rows: payload })
      if (error) throw error
      return data as unknown as ImportResult
    },
    onSettled: () => Promise.all(
      (['products', 'categories', 'stock', 'costs'] as const).map((k) =>
        queryClient.invalidateQueries({ queryKey: productKeys[k](orgId) })),
    ),
  })
}
