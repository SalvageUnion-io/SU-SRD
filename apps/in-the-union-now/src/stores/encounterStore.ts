/**
 * encounterStore — Zustand store for the GM encounter tray (design-review
 * R-5). Tracks EncounterNpc instances (reference NPCs with live HP/SP,
 * condition ticks, and Mediator roll history) in their own IndexedDB object
 * store.
 *
 * Same discipline as workspaceStore: lazy auto-hydration, write-through to
 * IndexedDB first, cross-tab invalidation via lib/db/broadcast, and the
 * backup nudge on every write. Workspace scoping mirrors the dashboard —
 * records carry an optional `workspaceId`; `listForWorkspace(null)` returns
 * everything ("All Builds").
 */

import { create } from 'zustand'

import { recordDataWrite } from '../lib/backupNudge'
import { publishStoreChange, subscribeStoreChanges } from '../lib/db/broadcast'
import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { EncounterNpc } from '../lib/schemas/encounterNpc'

/** db.create input — id/createdAt/updatedAt are injected by the db layer. */
export type EncounterNpcCreateInput = Omit<EncounterNpc, 'id' | 'createdAt' | 'updatedAt'>

type EncounterState = {
  encounterNpcs: EncounterNpc[]
  hydrated: boolean

  /** Loads all tracked NPCs from IndexedDB. Idempotent. */
  hydrate: () => Promise<void>

  /** Re-reads from IndexedDB even when already hydrated (cross-tab). */
  rehydrate: () => Promise<void>

  /** Sync list — returns in-memory records. Auto-triggers hydrate if needed. */
  list: () => EncounterNpc[]

  /** Sync get by id or null. */
  get: (id: string) => EncounterNpc | null

  /**
   * Tracked NPCs for a workspace; null = all ("All Builds", mirroring the
   * dashboard's workspace filter semantics).
   */
  listForWorkspace: (workspaceId: string | null) => EncounterNpc[]

  /** Adds a tracked NPC instance to the tray. Zod errors propagate. */
  create: (input: EncounterNpcCreateInput) => Promise<EncounterNpc>

  /** Merges patch, persists to db, updates in-memory state. */
  update: (id: string, patch: Partial<EncounterNpc>) => Promise<EncounterNpc>

  /** Removes a tracked NPC from the tray. */
  delete: (id: string) => Promise<void>
}

function afterWrite(): void {
  publishStoreChange(STORE_NAMES.encounterNpcs)
  recordDataWrite()
}

export const useEncounterStore = create<EncounterState>((set, get) => ({
  encounterNpcs: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return
    await get().rehydrate()
  },

  async rehydrate() {
    const records = await db.encounterNpcs.list()
    set({ encounterNpcs: records, hydrated: true })
  },

  list() {
    const state = get()
    if (!state.hydrated) {
      void state.hydrate()
    }
    return state.encounterNpcs
  },

  get(id) {
    const state = get()
    if (!state.hydrated) {
      void state.hydrate()
    }
    return state.encounterNpcs.find((n) => n.id === id) ?? null
  },

  listForWorkspace(workspaceId) {
    const all = get().list()
    if (workspaceId === null) return all
    return all.filter((n) => n.workspaceId === workspaceId)
  },

  async create(input) {
    const record = await db.encounterNpcs.create(input)
    set((state) => ({ encounterNpcs: [record, ...state.encounterNpcs] }))
    afterWrite()
    return record
  },

  async update(id, patch) {
    const updated = await db.encounterNpcs.update(id, patch)
    set((state) => ({
      encounterNpcs: state.encounterNpcs.map((n) => (n.id === id ? updated : n)),
    }))
    afterWrite()
    return updated
  },

  async delete(id) {
    await db.encounterNpcs.delete(id)
    set((state) => ({
      encounterNpcs: state.encounterNpcs.filter((n) => n.id !== id),
    }))
    afterWrite()
  },
}))

// Cross-tab invalidation for the encounterNpcs store.
subscribeStoreChanges((storeName) => {
  if (storeName !== STORE_NAMES.encounterNpcs) return
  const state = useEncounterStore.getState()
  if (!state.hydrated) return
  void state.rehydrate()
})
