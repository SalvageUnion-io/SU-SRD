/**
 * entityStore unit tests.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml — no explicit import needed.
 * Each test gets a clean store by calling _clearAllStores() in beforeEach and
 * resetting the Zustand store state manually.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, _resetDbSingleton, pilots as dbPilots } from '../../lib/db/index'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Baseline pilot input with all required fields. */
const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
}

/** Reset the Zustand entity store to its initial (un-hydrated) state. */
function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Hydration tests
// ---------------------------------------------------------------------------

describe('entityStore — hydration', () => {
  test('empty db: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots).toEqual([])
  })

  test('pre-seeded db: hydrate populates in-memory state', async () => {
    await dbPilots.create({ ...basePilotInput, name: 'Alpha' })
    await dbPilots.create({ ...basePilotInput, name: 'Beta' })

    await useEntityStore.getState().hydrate('pilot')
    const pilots = useEntityStore.getState().list('pilot')

    expect(pilots.length).toBe(2)
    const names = pilots.map((p) => p.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  test('hydrate is idempotent — calling twice does not duplicate entries', async () => {
    await dbPilots.create(basePilotInput)

    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().hydrate('pilot') // second call should be no-op
    const pilots = useEntityStore.getState().list('pilot')

    expect(pilots.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// CRUD write-through tests
// ---------------------------------------------------------------------------

describe('entityStore — create', () => {
  test('create writes to db and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Yara Voss')

    // In-memory list reflects the new record
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots.length).toBe(1)
    expect(pilots[0]?.id).toBe(created.id)

    // db also has it
    const fromDb = await dbPilots.get(created.id)
    expect(fromDb).not.toBeNull()
    expect(fromDb?.name).toBe('Yara Voss')
  })
})

describe('entityStore — update', () => {
  test('update merges patch and writes through to db', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

    await new Promise((r) => setTimeout(r, 5)) // ensure updatedAt differs

    const updated = await useEntityStore.getState().update(
      'pilot',
      created.id,
      {
        name: 'New Name',
        callsign: 'Wraith',
      },
      LIVE_SHEET_MANUAL
    )

    expect(updated.name).toBe('New Name')
    expect(updated.callsign).toBe('Wraith')
    expect(updated.classRef).toBe('scavenger') // unchanged field preserved

    // In-memory state is updated
    const inMemory = useEntityStore.getState().get('pilot', created.id)
    expect(inMemory?.name).toBe('New Name')

    // db has the new value
    const fromDb = await dbPilots.get(created.id)
    expect(fromDb?.name).toBe('New Name')
  })
})

describe('entityStore — delete', () => {
  test('delete removes from db and in-memory state', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

    await useEntityStore.getState().delete('pilot', created.id)

    // In-memory gone
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots.length).toBe(0)

    // db also gone
    const fromDb = await dbPilots.get(created.id)
    expect(fromDb).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Zod validation error propagation
// ---------------------------------------------------------------------------

describe('entityStore — Zod error propagation', () => {
  test('create propagates Zod validation error from db layer', async () => {
    await useEntityStore.getState().hydrate('pilot')

    const badInput = { ...basePilotInput } as Record<string, unknown>
    delete badInput.classRef // required field

    await expect(
      useEntityStore.getState().create('pilot', badInput as Parameters<typeof dbPilots.create>[0])
    ).rejects.toThrow()
  })
})
