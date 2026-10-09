/**
 * Signed out, the player-entity stores show nothing — not even what is on disk.
 *
 * There is no anonymous store: signed out, ITUN is read-only (ADR-034
 * decision 1, as amended), so a store has nothing of the session's to show. The
 * one thing it must not do is fall back to the IndexedDB cache, which may still
 * hold the last account's rows.
 *
 * Runs on the default (signed-out) backend on purpose: no `withSignedInBackend`.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { _resetDbSingleton, clearCache, mechPatterns, pilots } from '../../lib/db/index'
import { useEncounterStore } from '../encounterStore'
import { selectBackend } from '../entityBackend'
import { useEntityStore } from '../entityStore'
import { usePatternStore } from '../patternStore'

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
})

describe('signed out, a roster on disk stays on disk', () => {
  test('entities, patterns and the NPC tray all read empty', async () => {
    await pilots.put(pilotFixture({ id: 'on-disk' }))
    await mechPatterns.create({
      schemaVersion: 1,
      name: 'On disk',
      chassisRef: 'mule',
      systems: [],
      modules: [],
      cargoLots: [],
    })

    expect(selectBackend()).toBe('signedOut')
    await useEntityStore.getState().rehydrate('pilot')
    await usePatternStore.getState().rehydrate()
    await useEncounterStore.getState().rehydrate()

    expect(useEntityStore.getState().list('pilot')).toEqual([])
    expect(usePatternStore.getState().list()).toEqual([])
    expect(useEncounterStore.getState().list()).toEqual([])
    // Untouched: it is migrated on sign-in, not read or dropped here.
    expect((await pilots.list()).map((p) => p.id)).toEqual(['on-disk'])
  })
})
