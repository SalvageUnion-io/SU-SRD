/**
 * patternStore — Zustand store for saved MechPatterns (audit item 22).
 *
 * Patterns previously BYPASSED the store layer: PatternList read
 * db.mechPatterns directly into local useEffect state and SavePatternButton
 * called db.mechPatterns.create() — so pattern writes never reached the
 * backup nudge (un-exported patterns could go stale-lossy) and never
 * published cross-tab broadcast (other tabs kept stale lists). Routing them
 * through the shared collection slice closes both gaps.
 *
 * Patterns are immutable after creation (create/delete only in the UI), but
 * the slice's update() comes along for free should that change.
 */

import { create } from 'zustand'
import * as db from '../lib/db/index'
import { makeMemoryStore } from '../lib/db/memoryStore'
import { STORE_NAMES } from '../lib/db/stores'
import type { MechPattern } from '../lib/schemas/pattern'
import { MechPatternSchema } from '../lib/schemas/pattern'
import { commitPatternWrite, selectBackend } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice, wireCrossTabInvalidation } from './makeHydratedCollection'

/** db.create input — id/createdAt are injected by the db layer. */
export type MechPatternCreateInput = Omit<MechPattern, 'id' | 'createdAt' | 'updatedAt'>

type PatternState = HydratedCollectionSlice<'mechPatterns', MechPattern> &
  HydratedCollectionActions<MechPattern, MechPatternCreateInput>

/**
 * The anonymous backing for saved patterns (ADR-034 decision 1).
 *
 * Built at module scope so it HOLDS the rows: a store created per call would
 * hand every read an empty Map. Mirrors `entityStore`'s `MEMORY_STORES`.
 */
const memoryPatterns = makeMemoryStore(MechPatternSchema, STORE_NAMES.mechPatterns, {
  hasUpdatedAt: true,
})

const slice = makeHydratedCollectionSlice<'mechPatterns', MechPattern, MechPatternCreateInput>({
  key: 'mechPatterns',
  db: () => (selectBackend() === 'memory' ? memoryPatterns : db.mechPatterns),
  storeName: STORE_NAMES.mechPatterns,
  shouldBroadcast: () => selectBackend() !== 'memory',
  /**
   * The per-write mirror (ADR-034 P4b).
   *
   * Before this, a saved pattern reached Convex through one path only — the
   * bulk `claimLocal` at sign-in — so every pattern saved afterwards was
   * invisible on a second device and lost with the site data.
   */
  commit: commitPatternWrite,
})

export const usePatternStore = create<PatternState>((set, get) => ({
  ...slice(set, get),
}))

wireCrossTabInvalidation(usePatternStore, STORE_NAMES.mechPatterns)
