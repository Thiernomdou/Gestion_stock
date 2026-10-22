import Dexie, { type EntityTable } from 'dexie'

// Base locale (IndexedDB) — CLAUDE.md §6.
// Les tables de référence (produits, clients, stock…) seront ajoutées avec le mode
// hors ligne complet, via une nouvelle version du schéma (this.version(2)…).

export type OutboxType = 'sale' | 'expense' | 'credit_repayment'

export interface OutboxEntry {
  id: string            // UUID de l'opération (= identifiant envoyé à la RPC, garantit l'idempotence)
  type: OutboxType
  payload: unknown
  created_at: string
  attempts: number
  last_error: string | null
}

export interface MetaEntry {
  key: string           // ex. 'last_sync_at'
  value: string
}

class LocalDB extends Dexie {
  outbox!: EntityTable<OutboxEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('gestion-stock')
    this.version(1).stores({
      outbox: 'id, type, created_at',
      meta: 'key',
    })
  }
}

export const db = new LocalDB()
