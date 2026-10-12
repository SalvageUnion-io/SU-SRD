/**
 * entityStore unit tests.
 *
 * The store holds rows in memory only; each test starts from `resetStores()`.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'
import type { CreateInput } from '../types'
import type { MonotonicClock } from './monotonicClock'
import { installMonotonicClock } from './monotonicClock'
import { resetStores } from './resetStores'
import { withSignedInBackend } from './signedInBackend'

// These write, and only the signed-in backend writes. See signedInBackend.ts.
withSignedInBackend()

// `createdAt` / `updatedAt` come from `new Date()` inside `records.ts`. A monotonic clock makes consecutive writes distinct and
// ordered by construction, so the ordering assertions below need no sleeping.
let clock: MonotonicClock

beforeAll(() => {
  clock = installMonotonicClock()
})

afterAll(() => {
  clock.restore()
})

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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  resetStores()
})

// ---------------------------------------------------------------------------
// Hydration tests
// ---------------------------------------------------------------------------

describe('entityStore — hydration', () => {
  test('nothing arrived: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots).toEqual([])
  })

  test('adopted server rows are what a hydrated list returns', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'a', name: 'Alpha' }))
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'b', name: 'Beta' }))

    await useEntityStore.getState().hydrate('pilot')
    const pilots = useEntityStore.getState().list('pilot')

    expect(pilots.length).toBe(2)
    const names = pilots.map((p) => p.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  test('hydrate is idempotent — calling twice does not duplicate entries', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'a' }))

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
  test('create commits and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Yara Voss')

    // In-memory list reflects the new record
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots.length).toBe(1)
    expect(pilots[0]?.id).toBe(created.id)
    expect(created.createdAt).toBe(created.updatedAt)
  })
})

describe('entityStore — update', () => {
  test('update merges the patch and bumps updatedAt', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

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
    expect(updated.updatedAt > created.updatedAt).toBe(true)
    expect(updated.createdAt).toBe(created.createdAt)
  })

  test('update of a record the store does not hold throws', async () => {
    await expect(
      useEntityStore.getState().update('pilot', 'missing', { name: 'X' }, LIVE_SHEET_MANUAL)
    ).rejects.toThrow(/not found/)
  })
})

describe('entityStore — delete', () => {
  test('delete removes it from in-memory state', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const created = await useEntityStore.getState().create('pilot', basePilotInput)

    await useEntityStore.getState().delete('pilot', created.id)

    // In-memory gone
    const pilots = useEntityStore.getState().list('pilot')
    expect(pilots.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Zod validation error propagation
// ---------------------------------------------------------------------------

describe('entityStore — Zod error propagation', () => {
  test('create propagates the Zod validation error', async () => {
    await useEntityStore.getState().hydrate('pilot')

    const badInput = { ...basePilotInput } as Record<string, unknown>
    delete badInput.classRef // required field

    await expect(
      useEntityStore.getState().create('pilot', badInput as CreateInput<'pilot'>)
    ).rejects.toThrow()
  })
})
