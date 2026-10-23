import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type CartLine, normalizeQty, type PriceMode } from './cart'

export interface Cart {
  /** Identifiant de la vente, fixé dès le premier article : renvoyer la même vente ne la duplique pas. */
  saleId: string
  lines: CartLine[]
  globalDiscount: number
  customerId: string | null
}

const emptyCart = (): Cart => ({ saleId: crypto.randomUUID(), lines: [], globalDiscount: 0, customerId: null })

interface ProductLike {
  id: string; name: string; unit: string; allow_decimal_qty: boolean; sale_price: number; wholesale_price: number | null
}

interface PosState {
  /** Un panier par boutique : changer de boutique ne mélange pas les ventes. */
  carts: Record<string, Cart>
  add: (storeId: string, product: ProductLike, quantity?: number) => void
  setQuantity: (storeId: string, lineId: string, quantity: number) => void
  setPriceMode: (storeId: string, lineId: string, mode: PriceMode, product: ProductLike) => void
  setLineDiscount: (storeId: string, lineId: string, discount: number) => void
  remove: (storeId: string, lineId: string) => void
  setGlobalDiscount: (storeId: string, discount: number) => void
  setCustomer: (storeId: string, customerId: string | null) => void
  clear: (storeId: string) => void
}

const priceFor = (p: ProductLike, mode: PriceMode) => (mode === 'wholesale' && p.wholesale_price !== null ? p.wholesale_price : p.sale_price)

// Panier conservé sur l'appareil : une coupure de courant ou un rechargement ne le vide pas.
export const usePos = create<PosState>()(
  persist(
    (set) => {
      const update = (storeId: string, fn: (cart: Cart) => Cart) =>
        set((s) => ({ carts: { ...s.carts, [storeId]: fn(s.carts[storeId] ?? emptyCart()) } }))
      const updateLine = (storeId: string, lineId: string, fn: (l: CartLine) => CartLine) =>
        update(storeId, (c) => ({ ...c, lines: c.lines.map((l) => (l.id === lineId ? fn(l) : l)) }))

      return {
        carts: {},
        add: (storeId, p, quantity = 1) => update(storeId, (c) => {
          const existing = c.lines.find((l) => l.productId === p.id)
          if (existing) {
            return { ...c, lines: c.lines.map((l) => (l === existing ? { ...l, quantity: normalizeQty(l.quantity + quantity, l.decimal) } : l)) }
          }
          const line: CartLine = {
            id: crypto.randomUUID(), productId: p.id, name: p.name, unit: p.unit, decimal: p.allow_decimal_qty,
            quantity: normalizeQty(quantity, p.allow_decimal_qty) || 1, priceMode: 'retail', unitPrice: p.sale_price, discount: 0,
          }
          return { ...c, lines: [...c.lines, line] }
        }),
        setQuantity: (storeId, lineId, quantity) => updateLine(storeId, lineId, (l) => ({ ...l, quantity: normalizeQty(quantity, l.decimal) })),
        setPriceMode: (storeId, lineId, mode, p) => updateLine(storeId, lineId, (l) => ({ ...l, priceMode: mode, unitPrice: priceFor(p, mode), discount: 0 })),
        setLineDiscount: (storeId, lineId, discount) => updateLine(storeId, lineId, (l) => ({ ...l, discount: Math.max(0, Math.round(discount)) })),
        remove: (storeId, lineId) => update(storeId, (c) => ({ ...c, lines: c.lines.filter((l) => l.id !== lineId) })),
        setGlobalDiscount: (storeId, discount) => update(storeId, (c) => ({ ...c, globalDiscount: Math.max(0, Math.round(discount)) })),
        setCustomer: (storeId, customerId) => update(storeId, (c) => ({ ...c, customerId })),
        clear: (storeId) => set((s) => ({ carts: { ...s.carts, [storeId]: emptyCart() } })),
      }
    },
    { name: 'pos-carts', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
)

const EMPTY = emptyCart()

/** Panier de la boutique en cours (vide et stable tant qu'aucun article n'a été ajouté). */
export function useCart(storeId: string | undefined): Cart {
  return usePos((s) => (storeId ? s.carts[storeId] : undefined)) ?? EMPTY
}
