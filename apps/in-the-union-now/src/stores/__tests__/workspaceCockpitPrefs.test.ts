/**
 * Persistence test for Play Cockpit Phase 7 dial prefs.
 *
 * cockpitPrefs is a purely additive-optional field on the Workspace record, so
 * it needs no migration. This proves it round-trips through IndexedDB: a write
 * survives a store reset + rehydrate (i.e. a page reload), and older records
 * without the field still load.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import type { CockpitPrefs } from '../../lib/schemas/cockpitPrefs'
import { useWorkspaceStore } from '../workspaceStore'

function resetStore(): void {
  useWorkspaceStore.setState({ workspaces: [], hydrated: false })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetStore()
})

const prefs: CockpitPrefs = { hidden: ['pilot', 'srd'], order: ['tables', 'actions'] }

describe('workspace cockpitPrefs persistence', () => {
  test('cockpitPrefs written to a workspace survives a reload (reset + rehydrate)', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Table' })
    await useWorkspaceStore.getState().update(ws.id, { cockpitPrefs: prefs })

    // Simulate a page reload: drop in-memory state, then hydrate from IndexedDB.
    resetStore()
    await useWorkspaceStore.getState().rehydrate()

    const reloaded = useWorkspaceStore.getState().get(ws.id)
    expect(reloaded?.cockpitPrefs).toEqual(prefs)
  })

  test('a workspace without cockpitPrefs still loads (older record)', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Legacy' })
    resetStore()
    await useWorkspaceStore.getState().rehydrate()

    const reloaded = useWorkspaceStore.getState().get(ws.id)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.cockpitPrefs).toBeUndefined()
  })

  test('cockpitPrefs can be cleared back to undefined', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Table' })
    await useWorkspaceStore.getState().update(ws.id, { cockpitPrefs: prefs })
    await useWorkspaceStore.getState().update(ws.id, { cockpitPrefs: undefined })

    resetStore()
    await useWorkspaceStore.getState().rehydrate()
    expect(useWorkspaceStore.getState().get(ws.id)?.cockpitPrefs).toBeUndefined()
  })
})
