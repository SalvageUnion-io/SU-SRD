/**
 * patternStore — Zustand store for saved MechPatterns (audit item 22).
 *
 * Patterns go through the shared collection slice, so every write commits to
 * the server of record before the store holds it.
 *
 * Patterns are immutable after creation (create/delete only in the UI), but
 * the slice's update() comes along for free should that change.
 */

import { create } from 'zustand'
import type { MechPattern } from '../lib/schemas/pattern'
import { commitPatternWrite } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice } from './makeHydratedCollection'
import { RECORD_KINDS } from './records'

/** create input — id/createdAt are injected by `prepareCreate`. */
export type MechPatternCreateInput = Omit<MechPattern, 'id' | 'createdAt' | 'updatedAt'>

type PatternState = HydratedCollectionSlice<'mechPatterns', MechPattern> &
  HydratedCollectionActions<MechPattern, MechPatternCreateInput>

const slice = makeHydratedCollectionSlice<'mechPatterns', MechPattern, MechPatternCreateInput>({
  key: 'mechPatterns',
  kind: RECORD_KINDS.mechPattern,
  /**
   * The server-first write (ADR-034).
   *
   * Without it a saved pattern would be invisible on a second device and lost
   * with the site data.
   */
  commit: commitPatternWrite,
})

export const usePatternStore = create<PatternState>((set, get, api) => ({
  ...slice(set, get, api.subscribe),
}))
