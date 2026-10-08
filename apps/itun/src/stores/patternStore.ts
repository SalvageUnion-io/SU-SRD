/**
 * patternStore — Zustand store for saved MechPatterns (audit item 22).
 *
 * Patterns previously BYPASSED the store layer: PatternList read
 * db.mechPatterns directly into local useEffect state and SavePatternButton
 * called db.mechPatterns.create() — so pattern writes never published
 * cross-tab broadcast (other tabs kept stale lists). Routing them through the
 * shared collection slice closes that gap.
 *
 * Patterns are immutable after creation (create/delete only in the UI), but
 * the slice's update() comes along for free should that change.
 */

import { create } from 'zustand'
import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { MechPattern } from '../lib/schemas/pattern'
import { commitPatternWrite } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice, wireCrossTabInvalidation } from './makeHydratedCollection'

/** db.create input — id/createdAt are injected by the db layer. */
export type MechPatternCreateInput = Omit<MechPattern, 'id' | 'createdAt' | 'updatedAt'>

type PatternState = HydratedCollectionSlice<'mechPatterns', MechPattern> &
  HydratedCollectionActions<MechPattern, MechPatternCreateInput>

const slice = makeHydratedCollectionSlice<'mechPatterns', MechPattern, MechPatternCreateInput>({
  key: 'mechPatterns',
  db: db.mechPatterns,
  storeName: STORE_NAMES.mechPatterns,
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
