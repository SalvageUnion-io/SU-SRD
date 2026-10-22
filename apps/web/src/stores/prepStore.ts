/**
 * prepStore — Zustand store for the Mediator's encounters (ADR-058): the
 * opposition, tables and notes they prep on their shelf before a session.
 *
 * Built on the shared collection slice, so every write commits to the server
 * of record before the store holds it. Shelf-only and always the owner's, like
 * patterns: a Game runs a copy (`mediator.runEncounter`) and never holds one.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import { create } from 'zustand'
import { commitEncounterWrite } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice } from './makeHydratedCollection'
import { RECORD_KINDS } from './records'

/** create input — id/createdAt/updatedAt are injected by `prepareCreate`. */
export type EncounterCreateInput = Omit<Encounter, 'id' | 'createdAt' | 'updatedAt'>

type PrepState = HydratedCollectionSlice<'encounters', Encounter> &
  HydratedCollectionActions<Encounter, EncounterCreateInput>

const slice = makeHydratedCollectionSlice<'encounters', Encounter, EncounterCreateInput>({
  key: 'encounters',
  kind: RECORD_KINDS.encounter,
  /** The server-first write (ADR-034): an encounter prepped here is there on the night's device. */
  commit: commitEncounterWrite,
})

export const usePrepStore = create<PrepState>((set, get, api) => ({
  ...slice(set, get, api.subscribe),
}))
