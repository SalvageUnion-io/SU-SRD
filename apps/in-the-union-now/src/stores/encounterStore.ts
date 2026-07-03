/**
 * encounterStore — Zustand store for the GM encounter tray (design-review
 * R-5). Tracks EncounterNpc instances (reference NPCs with live HP/SP,
 * condition ticks, and Mediator roll history) in their own IndexedDB object
 * store.
 *
 * Built on makeHydratedCollectionSlice (ADR-003 discipline: lazy
 * auto-hydration, write-through, cross-tab invalidation, backup nudge).
 * Workspace scoping mirrors the dashboard — records carry an optional
 * `workspaceId`; `listForWorkspace(null)` returns everything ("All Builds").
 */

import { create } from 'zustand'

import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { EncounterNpc } from '../lib/schemas/encounterNpc'
import {
  makeHydratedCollectionSlice,
  wireCrossTabInvalidation,
  type HydratedCollectionActions,
  type HydratedCollectionSlice,
} from './makeHydratedCollection'

/** db.create input — id/createdAt/updatedAt are injected by the db layer. */
export type EncounterNpcCreateInput = Omit<EncounterNpc, 'id' | 'createdAt' | 'updatedAt'>

type EncounterState = HydratedCollectionSlice<'encounterNpcs', EncounterNpc> &
  HydratedCollectionActions<EncounterNpc, EncounterNpcCreateInput> & {
    /**
     * Tracked NPCs for a workspace; null = all ("All Builds", mirroring the
     * dashboard's workspace filter semantics).
     */
    listForWorkspace: (workspaceId: string | null) => EncounterNpc[]
  }

const slice = makeHydratedCollectionSlice<'encounterNpcs', EncounterNpc, EncounterNpcCreateInput>({
  key: 'encounterNpcs',
  db: db.encounterNpcs,
  storeName: STORE_NAMES.encounterNpcs,
})

export const useEncounterStore = create<EncounterState>((set, get) => ({
  ...slice(set, get),

  listForWorkspace(workspaceId) {
    const all = get().list()
    if (workspaceId === null) return all
    return all.filter((n) => n.workspaceId === workspaceId)
  },
}))

wireCrossTabInvalidation(useEncounterStore, STORE_NAMES.encounterNpcs)
