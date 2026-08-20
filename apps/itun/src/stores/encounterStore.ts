/**
 * encounterStore — Zustand store for the GM encounter tray (design-review
 * R-5). Tracks EncounterNpc instances (reference NPCs with live HP/SP,
 * condition ticks, and Mediator roll history) in their own IndexedDB object
 * store.
 *
 * Built on makeHydratedCollectionSlice (ADR-003 discipline: lazy
 * auto-hydration, write-through, cross-tab invalidation, backup nudge).
 * Container scoping mirrors the roster — records resolve through
 * `containerOf`; `listForContainer(null)` returns everything, which is what a
 * Solo user always gets (no account means no Games to scope to).
 */

import { create } from 'zustand'
import type { Container } from '../lib/container'
import { containerOf, sameContainer } from '../lib/container'
import * as db from '../lib/db/index'
import { makeMemoryStore } from '../lib/db/memoryStore'
import { STORE_NAMES } from '../lib/db/stores'
import type { EncounterNpc } from '../lib/schemas/encounterNpc'
import { EncounterNpcSchema } from '../lib/schemas/encounterNpc'
import { selectBackend } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice, wireCrossTabInvalidation } from './makeHydratedCollection'

/** db.create input — id/createdAt/updatedAt are injected by the db layer. */
export type EncounterNpcCreateInput = Omit<EncounterNpc, 'id' | 'createdAt' | 'updatedAt'>

type EncounterState = HydratedCollectionSlice<'encounterNpcs', EncounterNpc> &
  HydratedCollectionActions<EncounterNpc, EncounterNpcCreateInput> & {
    /**
     * Tracked NPCs in one container; null = all, mirroring the roster's
     * unfiltered Solo view.
     */
    listForContainer: (container: Container | null) => EncounterNpc[]
  }

/** The anonymous backing for the NPC tray — see `patternStore` for the shape. */
const memoryNpcs = makeMemoryStore(EncounterNpcSchema, STORE_NAMES.encounterNpcs, {
  hasUpdatedAt: true,
})

const slice = makeHydratedCollectionSlice<'encounterNpcs', EncounterNpc, EncounterNpcCreateInput>({
  key: 'encounterNpcs',
  db: () => (selectBackend() === 'memory' ? memoryNpcs : db.encounterNpcs),
  storeName: STORE_NAMES.encounterNpcs,
  shouldBroadcast: () => selectBackend() !== 'memory',
})

export const useEncounterStore = create<EncounterState>((set, get) => ({
  ...slice(set, get),

  listForContainer(container) {
    const all = get().list()
    if (container === null) return all
    return all.filter((n) => sameContainer(containerOf(n), container))
  },
}))

wireCrossTabInvalidation(useEncounterStore, STORE_NAMES.encounterNpcs)
