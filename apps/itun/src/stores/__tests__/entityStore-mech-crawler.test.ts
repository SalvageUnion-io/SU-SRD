/**
 * entityStore — mech and crawler CRUD write-through tests (#244).
 *
 * entityStore.test.ts covers pilots only. This file extends coverage to mechs
 * and crawlers: create/get/update/delete round-trips against the real IndexedDB
 * (via fake-indexeddb), including a currentXxx stat-field write-through.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  _clearAllStores,
  _resetDbSingleton,
  mechs as dbMechs,
  crawlers as dbCrawlers,
} from '../../lib/db/index'
import { useEntityStore } from '../entityStore'
import { LIVE_SHEET_MANUAL } from '../surfaceProvenance'

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

// ===========================================================================
// Mech
// ===========================================================================

describe('entityStore — mech hydration', () => {
  test('empty db: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')
    expect(result).toEqual([])
  })

  test('pre-seeded db: hydrate populates in-memory state', async () => {
    await dbMechs.create({ ...baseMechInput, name: 'Alpha' })
    await dbMechs.create({ ...baseMechInput, name: 'Beta' })

    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')

    expect(result.length).toBe(2)
    const names = result.map((m) => m.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
  })

  test('hydrate is idempotent for mechs', async () => {
    await dbMechs.create(baseMechInput)

    await useEntityStore.getState().hydrate('mech')
    await useEntityStore.getState().hydrate('mech')
    const result = useEntityStore.getState().list('mech')
    expect(result.length).toBe(1)
  })
})

describe('entityStore — mech create', () => {
  test('create writes to db and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Store Test Mech')

    const inMemory = useEntityStore.getState().list('mech')
    expect(inMemory.length).toBe(1)
    expect(inMemory[0]?.id).toBe(created.id)

    const fromDb = await dbMechs.get(created.id)
    expect(fromDb).not.toBeNull()
    expect(fromDb?.name).toBe('Store Test Mech')
  })
})

describe('entityStore — mech update', () => {
  test('update merges patch and writes through to db', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    await new Promise((r) => setTimeout(r, 5))

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

    const fromDb = await dbMechs.get(created.id)
    expect(fromDb?.name).toBe('Renamed Mech')
  })

  test('update with currentHP writes stat through to db', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    await useEntityStore.getState().update('mech', created.id, { currentHP: 7 }, LIVE_SHEET_MANUAL)

    const inMemory = useEntityStore.getState().get('mech', created.id)
    expect(inMemory?.currentHP).toBe(7)

    const fromDb = await dbMechs.get(created.id)
    expect(fromDb?.currentHP).toBe(7)
  })
})

describe('entityStore — mech delete', () => {
  test('delete removes from db and in-memory state', async () => {
    await useEntityStore.getState().hydrate('mech')
    const created = await useEntityStore.getState().create('mech', baseMechInput)

    await useEntityStore.getState().delete('mech', created.id)

    const inMemory = useEntityStore.getState().list('mech')
    expect(inMemory.length).toBe(0)

    const fromDb = await dbMechs.get(created.id)
    expect(fromDb).toBeNull()
  })
})

// ===========================================================================
// Crawler
// ===========================================================================

describe('entityStore — crawler hydration', () => {
  test('empty db: hydrate then list returns []', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')
    expect(result).toEqual([])
  })

  test('pre-seeded db: hydrate populates in-memory state', async () => {
    await dbCrawlers.create({ ...baseCrawlerInput, name: 'Crawler A' })
    await dbCrawlers.create({ ...baseCrawlerInput, name: 'Crawler B' })

    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')

    expect(result.length).toBe(2)
    const names = result.map((c) => c.name)
    expect(names).toContain('Crawler A')
    expect(names).toContain('Crawler B')
  })

  test('hydrate is idempotent for crawlers', async () => {
    await dbCrawlers.create(baseCrawlerInput)

    await useEntityStore.getState().hydrate('crawler')
    await useEntityStore.getState().hydrate('crawler')
    const result = useEntityStore.getState().list('crawler')
    expect(result.length).toBe(1)
  })
})

describe('entityStore — crawler create', () => {
  test('create writes to db and updates in-memory state', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    expect(created.id).toBeDefined()
    expect(created.name).toBe('Store Test Crawler')

    const inMemory = useEntityStore.getState().list('crawler')
    expect(inMemory.length).toBe(1)
    expect(inMemory[0]?.id).toBe(created.id)

    const fromDb = await dbCrawlers.get(created.id)
    expect(fromDb).not.toBeNull()
    expect(fromDb?.name).toBe('Store Test Crawler')
  })
})

describe('entityStore — crawler update', () => {
  test('update merges patch and writes through to db', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    await new Promise((r) => setTimeout(r, 5))

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

    const fromDb = await dbCrawlers.get(created.id)
    expect(fromDb?.name).toBe('Renamed Crawler')
  })

  test('update with currentSP writes stat through to db', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    await useEntityStore
      .getState()
      .update('crawler', created.id, { currentSP: 40 }, LIVE_SHEET_MANUAL)

    const inMemory = useEntityStore.getState().get('crawler', created.id)
    expect(inMemory?.currentSP).toBe(40)

    const fromDb = await dbCrawlers.get(created.id)
    expect(fromDb?.currentSP).toBe(40)
  })
})

describe('entityStore — crawler delete', () => {
  test('delete removes from db and in-memory state', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const created = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    await useEntityStore.getState().delete('crawler', created.id)

    const inMemory = useEntityStore.getState().list('crawler')
    expect(inMemory.length).toBe(0)

    const fromDb = await dbCrawlers.get(created.id)
    expect(fromDb).toBeNull()
  })
})
