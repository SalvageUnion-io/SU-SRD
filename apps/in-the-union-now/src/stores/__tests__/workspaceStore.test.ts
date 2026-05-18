/**
 * workspaceStore unit tests.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * Both stores (entity + workspace) are reset in beforeEach to prevent
 * inter-test state leakage.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import { useEntityStore } from '../entityStore'
import { useWorkspaceStore } from '../workspaceStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Test Pilot',
  callsign: 'Tester',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  rollResults: [],
  motto: '',
  keepsake: '',
  appearance: '',
  conditions: [],
}

function resetStores(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  useWorkspaceStore.setState({
    workspaces: [],
    hydrated: false,
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetStores()
})

afterEach(async () => {
  await _clearAllStores()
  resetStores()
})

// ---------------------------------------------------------------------------
// Workspace CRUD
// ---------------------------------------------------------------------------

describe('workspaceStore — create', () => {
  test('creates a workspace and returns it', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Campaign 1' })
    expect(ws.id).toBeDefined()
    expect(ws.name).toBe('Campaign 1')
    expect(ws.schemaVersion).toBe(1)

    const list = useWorkspaceStore.getState().list()
    expect(list.length).toBe(1)
    expect(list[0]!.id).toBe(ws.id)
  })
})

describe('workspaceStore — rename', () => {
  test('rename updates the workspace name', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Old Name' })
    const renamed = await useWorkspaceStore.getState().rename(ws.id, 'New Name')

    expect(renamed.name).toBe('New Name')

    const inMemory = useWorkspaceStore.getState().get(ws.id)
    expect(inMemory?.name).toBe('New Name')
  })
})

describe('workspaceStore — delete', () => {
  test('delete removes the workspace', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'To Delete' })
    await useWorkspaceStore.getState().delete(ws.id)

    const list = useWorkspaceStore.getState().list()
    expect(list.length).toBe(0)

    const fetched = useWorkspaceStore.getState().get(ws.id)
    expect(fetched).toBeNull()
  })

  test('delete workspace does NOT cascade to entities — entities keep workspaceId', async () => {
    // Create workspace and assign a pilot
    const ws = await useWorkspaceStore.getState().create({ name: 'Campaign' })
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)
    await useWorkspaceStore.getState().assign('pilot', pilot.id, ws.id)

    // Verify assignment
    const assigned = useWorkspaceStore.getState().listForWorkspace(ws.id, 'pilot')
    expect(assigned.length).toBe(1)

    // Delete workspace
    await useWorkspaceStore.getState().delete(ws.id)

    // Entity still exists with workspaceId set (orphaned, not auto-cleaned)
    const stillHasWorkspaceId = useEntityStore.getState().get('pilot', pilot.id)
    expect(stillHasWorkspaceId?.workspaceId).toBe(ws.id)

    // It no longer appears in listUnassigned (has workspaceId) or listForWorkspace
    // for the deleted ws (ws is gone but this is a query on entity data, not ws data)
    const unassigned = useWorkspaceStore.getState().listUnassigned('pilot')
    expect(unassigned.find((p) => p.id === pilot.id)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Assign / unassign
// ---------------------------------------------------------------------------

describe('workspaceStore — assign', () => {
  test('assign sets workspaceId; listForWorkspace returns entity', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Campaign' })
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)

    await useWorkspaceStore.getState().assign('pilot', pilot.id, ws.id)

    const forWorkspace = useWorkspaceStore.getState().listForWorkspace(ws.id, 'pilot')
    expect(forWorkspace.length).toBe(1)
    expect(forWorkspace[0]!.id).toBe(pilot.id)
    expect(forWorkspace[0]!.workspaceId).toBe(ws.id)
  })
})

describe('workspaceStore — unassign', () => {
  test('unassign clears workspaceId; entity moves to unassigned pool', async () => {
    const ws = await useWorkspaceStore.getState().create({ name: 'Campaign' })
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)

    await useWorkspaceStore.getState().assign('pilot', pilot.id, ws.id)
    await useWorkspaceStore.getState().unassign('pilot', pilot.id)

    // No longer in workspace
    const forWorkspace = useWorkspaceStore.getState().listForWorkspace(ws.id, 'pilot')
    expect(forWorkspace.length).toBe(0)

    // Now in unassigned pool
    const unassigned = useWorkspaceStore.getState().listUnassigned('pilot')
    expect(unassigned.length).toBe(1)
    expect(unassigned[0]!.id).toBe(pilot.id)
    expect(unassigned[0]!.workspaceId).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// listForWorkspace / listUnassigned
// ---------------------------------------------------------------------------

describe('workspaceStore — listForWorkspace', () => {
  test('returns only entities assigned to the specified workspace', async () => {
    const ws1 = await useWorkspaceStore.getState().create({ name: 'Workspace 1' })
    const ws2 = await useWorkspaceStore.getState().create({ name: 'Workspace 2' })

    await useEntityStore.getState().hydrate('pilot')
    const p1 = await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'P1' })
    const p2 = await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'P2' })
    const p3 = await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'P3' })

    await useWorkspaceStore.getState().assign('pilot', p1.id, ws1.id)
    await useWorkspaceStore.getState().assign('pilot', p2.id, ws2.id)
    // p3 unassigned

    const ws1Pilots = useWorkspaceStore.getState().listForWorkspace(ws1.id, 'pilot')
    expect(ws1Pilots.length).toBe(1)
    expect(ws1Pilots[0]!.id).toBe(p1.id)

    const ws2Pilots = useWorkspaceStore.getState().listForWorkspace(ws2.id, 'pilot')
    expect(ws2Pilots.length).toBe(1)
    expect(ws2Pilots[0]!.id).toBe(p2.id)

    const unassigned = useWorkspaceStore.getState().listUnassigned('pilot')
    expect(unassigned.length).toBe(1)
    expect(unassigned[0]!.id).toBe(p3.id)
  })
})
