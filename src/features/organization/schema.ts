import { z } from 'zod'

// Paramètres propres à chaque client : organizations.settings (CLAUDE.md §4).
// Lus avec des valeurs par défaut pour qu'une clé absente ne casse jamais l'interface.
export const orgSettingsSchema = z.object({
  payment_methods: z.array(z.string()).prefault(['cash']),
  units: z.array(z.string()).prefault(['pièce']),
  allow_negative_stock: z.boolean().prefault(true),
  cashier_can_discount: z.boolean().prefault(false),
  max_discount_percent: z.number().min(0).max(100).prefault(0),
  receipt: z
    .object({
      width_mm: z.union([z.literal(58), z.literal(80)]).prefault(80),
      header: z.string().prefault(''),
      footer: z.string().prefault(''),
    })
    .prefault({}),
  expense_categories: z.array(z.string()).prefault([]),
})

export type OrgSettings = z.infer<typeof orgSettingsSchema>

export function parseSettings(json: unknown): OrgSettings {
  const result = orgSettingsSchema.safeParse(json ?? {})
  return result.success ? result.data : orgSettingsSchema.parse({})
}

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80),
  storeName: z.string().trim().max(80),
})

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
