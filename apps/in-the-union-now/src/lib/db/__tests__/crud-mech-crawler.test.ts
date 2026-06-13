/**
 * DB CRUD round-trips for 'mech' and 'crawler' entity types (#244).
 *
 * crud.test.ts covers pilots only. This file extends coverage to mechs and
 * crawlers — create/get/update/delete round-trips, including a currentXxx
 * stat-field write-through.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { _clearAllStores, mechs, crawlers } from '../index'

beforeEach(async () => {
  await _clearAllStores()
})

afterEach(async () => {
  await _clearAllStores()
})

// ---------------------------------------------------------------------------
// Mech base input
// ---------------------------------------------------------------------------

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

// ---------------------------------------------------------------------------
// Crawler base input
// ---------------------------------------------------------------------------

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Test Crawler',
  techLevel: 'tech-2',
  systems: [],
}

// ===========================================================================
// Mech CRUD
// ===========================================================================

describe('mechs CRUD — create/get round-trip', () => {
  test('create then get returns equivalent record', async () => {
    const created = await mechs.create(baseMechInput)

    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.name).toBe('Test Mech')
    expect(created.chassisRef).toBe('iron-mongrel')
    expect(created.schemaVersion).toBe(1)

    const fetched = await mechs.get(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe(created.name)
    expect(fetched!.chassisRef).toBe(created.chassisRef)
    expect(fetched!.createdAt).toBe(created.createdAt)
    expect(fetched!.updatedAt).toBe(created.updatedAt)
  })
})

describe('mechs CRUD — list ordering', () => {
  test('list returns mechs newest-first by createdAt', async () => {
    const m1 = await mechs.create({ ...baseMechInput, name: 'Alpha' })
    await new Promise((r) => setTimeout(r, 5))
    const m2 = await mechs.create({ ...baseMechInput, name: 'Beta' })
    await new Promise((r) => setTimeout(r, 5))
    const m3 = await mechs.create({ ...baseMechInput, name: 'Gamma' })

    const all = await mechs.list()
    expect(all.length).toBe(3)
    expect(all[0]!.id).toBe(m3.id)
    expect(all[1]!.id).toBe(m2.id)
    expect(all[2]!.id).toBe(m1.id)
  })
})

describe('mechs CRUD — update merge', () => {
  test('update merges patch and bumps updatedAt', async () => {
    const created = await mechs.create(baseMechInput)
    const originalUpdatedAt = created.updatedAt

    await new Promise((r) => setTimeout(r, 5))

    const updated = await mechs.update(created.id, { name: 'Renamed Mech', chassisRef: 'scorpion' })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Renamed Mech')
    expect(updated.chassisRef).toBe('scorpion')
    // Unchanged fields preserved
    expect(updated.systems).toEqual([])
    expect(updated.createdAt).toBe(created.createdAt)
    // updatedAt bumped
    expect(updated.updatedAt).not.toBe(originalUpdatedAt)
  })

  test('update throws when id not found', async () => {
    await expect(mechs.update('nonexistent-mech', { name: 'X' })).rejects.toThrow(
      '[itun-db] Cannot update'
    )
  })
})

describe('mechs CRUD — currentHP stat write-through', () => {
  test('update with currentHP writes to db and is retrievable', async () => {
    const created = await mechs.create(baseMechInput)

    const updated = await mechs.update(created.id, { currentHP: 7 })
    expect(updated.currentHP).toBe(7)

    const fetched = await mechs.get(created.id)
    expect(fetched!.currentHP).toBe(7)
  })

  test('update with multiple stat fields persists all', async () => {
    const created = await mechs.create(baseMechInput)

    await mechs.update(created.id, {
      currentHP: 10,
      currentAP: 3,
      currentTP: 2,
      currentSP: 8,
      currentEP: 5,
      currentHeat: 4,
    })

    const fetched = await mechs.get(created.id)
    expect(fetched!.currentHP).toBe(10)
    expect(fetched!.currentAP).toBe(3)
    expect(fetched!.currentTP).toBe(2)
    expect(fetched!.currentSP).toBe(8)
    expect(fetched!.currentEP).toBe(5)
    expect(fetched!.currentHeat).toBe(4)
  })
})

describe('mechs CRUD — delete', () => {
  test('delete removes record; subsequent get returns null', async () => {
    const created = await mechs.create(baseMechInput)
    await mechs.delete(created.id)

    const fetched = await mechs.get(created.id)
    expect(fetched).toBeNull()
  })

  test('delete is a silent no-op for unknown id', async () => {
    await mechs.delete('does-not-exist')
  })
})

describe('mechs CRUD — Zod rejection', () => {
  test('create rejects invalid input: missing required chassisRef', async () => {
    const bad = { ...baseMechInput } as Record<string, unknown>
    delete bad['chassisRef']
    await expect(mechs.create(bad as Parameters<typeof mechs.create>[0])).rejects.toThrow()
  })
})

// ===========================================================================
// Crawler CRUD
// ===========================================================================

describe('crawlers CRUD — create/get round-trip', () => {
  test('create then get returns equivalent record', async () => {
    const created = await crawlers.create(baseCrawlerInput)

    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.name).toBe('Test Crawler')
    expect(created.techLevel).toBe('tech-2')
    expect(created.schemaVersion).toBe(1)

    const fetched = await crawlers.get(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe(created.name)
    expect(fetched!.techLevel).toBe(created.techLevel)
    expect(fetched!.createdAt).toBe(created.createdAt)
    expect(fetched!.updatedAt).toBe(created.updatedAt)
  })
})

describe('crawlers CRUD — list ordering', () => {
  test('list returns crawlers newest-first by createdAt', async () => {
    const c1 = await crawlers.create({ ...baseCrawlerInput, name: 'Alpha' })
    await new Promise((r) => setTimeout(r, 5))
    const c2 = await crawlers.create({ ...baseCrawlerInput, name: 'Beta' })
    await new Promise((r) => setTimeout(r, 5))
    const c3 = await crawlers.create({ ...baseCrawlerInput, name: 'Gamma' })

    const all = await crawlers.list()
    expect(all.length).toBe(3)
    expect(all[0]!.id).toBe(c3.id)
    expect(all[1]!.id).toBe(c2.id)
    expect(all[2]!.id).toBe(c1.id)
  })
})

describe('crawlers CRUD — update merge', () => {
  test('update merges patch and bumps updatedAt', async () => {
    const created = await crawlers.create(baseCrawlerInput)
    const originalUpdatedAt = created.updatedAt

    await new Promise((r) => setTimeout(r, 5))

    const updated = await crawlers.update(created.id, {
      name: 'Renamed Crawler',
      techLevel: 'tech-3',
    })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Renamed Crawler')
    expect(updated.techLevel).toBe('tech-3')
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt).not.toBe(originalUpdatedAt)
  })

  test('update throws when id not found', async () => {
    await expect(crawlers.update('nonexistent-crawler', { name: 'X' })).rejects.toThrow(
      '[itun-db] Cannot update'
    )
  })
})

describe('crawlers CRUD — currentSP stat write-through', () => {
  test('update with currentSP writes to db and is retrievable', async () => {
    const created = await crawlers.create(baseCrawlerInput)

    const updated = await crawlers.update(created.id, { currentSP: 25 })
    expect(updated.currentSP).toBe(25)

    const fetched = await crawlers.get(created.id)
    expect(fetched!.currentSP).toBe(25)
  })
})

describe('crawlers CRUD — delete', () => {
  test('delete removes record; subsequent get returns null', async () => {
    const created = await crawlers.create(baseCrawlerInput)
    await crawlers.delete(created.id)

    const fetched = await crawlers.get(created.id)
    expect(fetched).toBeNull()
  })

  test('delete is a silent no-op for unknown id', async () => {
    await crawlers.delete('does-not-exist')
  })
})

describe('crawlers CRUD — Zod rejection', () => {
  test('create rejects invalid input: missing required techLevel', async () => {
    const bad = { ...baseCrawlerInput } as Record<string, unknown>
    delete bad['techLevel']
    await expect(crawlers.create(bad as Parameters<typeof crawlers.create>[0])).rejects.toThrow()
  })
})
