/**
 * entityStore — mech and crawler CRUD write-through tests (#244).
 *
 * entityStore.test.ts covers pilots only. This file extends coverage to mechs
 * and crawlers: create/get/update/delete round-trips through the in-memory
 * store, including a currentXxx stat-field write-through.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, mechFixture } from '../../components/__tests__/fixtures'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'
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

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Store Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Store Test Crawler',
  techLevel: 'tech-1',
  systems: [],
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

// ===========================================================================
// Mech
// ===========================================================================

describe('entityStore — mech hydration', () => {
  test('nothing arrived: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')
    expect(result).toEqual([])
  })

  test('adopted server rows are what a hydrated list returns', async () => {
    await useEntityStore.getState().adopt('mech', mechFixture({ id: 'a', name: 'Alpha' }))
    await useEntityStore.getState().adopt('mech', mechFixture({ id: 'b', name: 'Beta' }))

    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')

    expect(result.length).toBe(2)
    const names = result.map((m) => m.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  test('hydrate is idempotent for mechs', async () => {
    await useEntityStore.getState().adopt('mech', mechFixture({ id: 'a' }))

    await useEntityStore.getState().hydrate('mech')
    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')
    expect(result.length).toBe(1)
  })
})

describe('entityStore — mech create', () => {
  test('create commits and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Store Test Mech')

    const inMemory = useEntityStore.getState().list('mech')
    expect(inMemory.length).toBe(1)
    expect(inMemory[0]?.id).toBe(created.id)

    const held = useEntityStore.getState().get('mech', created.id)
    expect(held).not.toBeNull()
    expect(held?.name).toBe('Store Test Mech')
  })
})

describe('entityStore — mech update', () => {
  test('update merges the patch', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    const updated = await useEntityStore.getState().update(
      'mech',
      created.id,
      {
        name: 'Renamed Mech',
        chassisRef: 'scorpion',
      },
      LIVE_SHEET_MANUAL
    )

    expect(updated.name).toBe('Renamed Mech')
    expect(updated.chassisRef).toBe('scorpion')

    const inMemory = useEntityStore.getState().get('mech', created.id)
    expect(inMemory?.name).toBe('Renamed Mech')

    const held = useEntityStore.getState().get('mech', created.id)
    expect(held?.name).toBe('Renamed Mech')
  })

  test('update with currentHP writes the stat through', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    await useEntityStore.getState().update('mech', created.id, { currentHP: 7 }, LIVE_SHEET_MANUAL)

    const inMemory = useEntityStore.getState().get('mech', created.id)
    expect(inMemory?.currentHP).toBe(7)

    const held = useEntityStore.getState().get('mech', created.id)
    expect(held?.currentHP).toBe(7)
  })
})

describe('entityStore — mech delete', () => {
  test('delete removes it from in-memory state', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    await useEntityStore.getState().delete('mech', created.id)

    const inMemory = useEntityStore.getState().list('mech')
    expect(inMemory.length).toBe(0)

    const held = useEntityStore.getState().get('mech', created.id)
    expect(held).toBeNull()
  })
})

// ===========================================================================
// Crawler
// ===========================================================================

describe('entityStore — crawler hydration', () => {
  test('nothing arrived: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')
    expect(result).toEqual([])
  })

  test('adopted server rows are what a hydrated list returns', async () => {
    await useEntityStore.getState().adopt('crawler', crawlerFixture({ id: 'a', name: 'Crawler A' }))
    await useEntityStore.getState().adopt('crawler', crawlerFixture({ id: 'b', name: 'Crawler B' }))

    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')

    expect(result.length).toBe(2)
    const names = result.map((c) => c.name)
    expect(names).toContain('Crawler A')
    expect(names).toContain('Crawler B')
  })

  test('hydrate is idempotent for crawlers', async () => {
    await useEntityStore.getState().adopt('crawler', crawlerFixture({ id: 'a' }))

    await useEntityStore.getState().hydrate('crawler')
    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')
    expect(result.length).toBe(1)
  })
})

describe('entityStore — crawler create', () => {
  test('create commits and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Store Test Crawler')

    const inMemory = useEntityStore.getState().list('crawler')
    expect(inMemory.length).toBe(1)
    expect(inMemory[0]?.id).toBe(created.id)

    const held = useEntityStore.getState().get('crawler', created.id)
    expect(held).not.toBeNull()
    expect(held?.name).toBe('Store Test Crawler')
  })
})

describe('entityStore — crawler update', () => {
  test('update merges the patch', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    const updated = await useEntityStore.getState().update(
      'crawler',
      created.id,
      {
        name: 'Renamed Crawler',
        techLevel: 'tech-4',
      },
      LIVE_SHEET_MANUAL
    )

    expect(updated.name).toBe('Renamed Crawler')
    expect(updated.techLevel).toBe('tech-4')

    const inMemory = useEntityStore.getState().get('crawler', created.id)
    expect(inMemory?.name).toBe('Renamed Crawler')

    const held = useEntityStore.getState().get('crawler', created.id)
    expect(held?.name).toBe('Renamed Crawler')
  })

  test('update with currentSP writes the stat through', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    await useEntityStore
      .getState()
      .update('crawler', created.id, { currentSP: 40 }, LIVE_SHEET_MANUAL)

    const inMemory = useEntityStore.getState().get('crawler', created.id)
    expect(inMemory?.currentSP).toBe(40)

    const held = useEntityStore.getState().get('crawler', created.id)
    expect(held?.currentSP).toBe(40)
  })
})

describe('entityStore — crawler delete', () => {
  test('delete removes it from in-memory state', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    await useEntityStore.getState().delete('crawler', created.id)

    const inMemory = useEntityStore.getState().list('crawler')
    expect(inMemory.length).toBe(0)

    const held = useEntityStore.getState().get('crawler', created.id)
    expect(held).toBeNull()
  })
})
