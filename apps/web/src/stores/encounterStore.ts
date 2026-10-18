/**
 * encounterStore — Zustand store for the GM encounter tray.
 * Tracks EncounterNpc instances (reference NPCs with live HP/SP,
 * condition ticks, and Mediator roll history).
 *
 * Built on makeHydratedCollectionSlice (rows from the server, server-first
 * writes). Container scoping mirrors the roster — records resolve through
 * `containerOf`; `listForContainer(null)` returns everything.
 */

import type { Container } from 'game-domain/container'
import { containerOf, sameContainer } from 'game-domain/container'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import { create } from 'zustand'
import { commitNpcWrite } from './entityBackend'
import type { HydratedCollectionActions, HydratedCollectionSlice } from './makeHydratedCollection'
import { makeHydratedCollectionSlice } from './makeHydratedCollection'
import { RECORD_KINDS } from './records'

/** create input — id/createdAt/updatedAt are injected by `prepareCreate`. */
export type EncounterNpcCreateInput = Omit<EncounterNpc, 'id' | 'createdAt' | 'updatedAt'>

type EncounterState = HydratedCollectionSlice<'encounterNpcs', EncounterNpc> &
  HydratedCollectionActions<EncounterNpc, EncounterNpcCreateInput> & {
    /**
     * Tracked NPCs in one container; null = all.
     */
    listForContainer: (container: Container | null) => EncounterNpc[]
  }

const slice = makeHydratedCollectionSlice<'encounterNpcs', EncounterNpc, EncounterNpcCreateInput>({
  key: 'encounterNpcs',
  kind: RECORD_KINDS.encounterNpc,
  /** The server-first write (ADR-034) — see `patternStore` for why. */
  commit: commitNpcWrite,
})

export const useEncounterStore = create<EncounterState>((set, get, api) => ({
  ...slice(set, get, api.subscribe),

  listForContainer(container) {
    const all = get().list()
    if (container === null) return all
    return all.filter((n) => sameContainer(containerOf(n), container))
  },
}))
