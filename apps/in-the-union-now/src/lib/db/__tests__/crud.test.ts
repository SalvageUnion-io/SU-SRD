import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

// fake-indexeddb/auto is loaded via bunfig.toml preload — it patches the global
// indexedDB so that idb's openDB() works in the test environment.

import { _clearAllStores, pilots } from '../index'

/**
 * Between each test: clear all IDB stores so state doesn't leak.
 * We keep the same DB connection across the test file (fake-indexeddb provides
 * a single in-memory instance per module load), but wipe records between cases.
 */
beforeEach(async () => {
  await _clearAllStores()
})

afterEach(async () => {
  await _clearAllStores()
})

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

describe('pilots CRUD — round-trip', () => {
  test('create then get returns equivalent record', async () => {
    const created = await pilots.create(basePilotInput)
    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.name).toBe('Yara Voss')
    expect(created.schemaVersion).toBe(1)

    const fetched = await pilots.get(created.id)
    expect(fetched).not.toBeNull()
    if (!fetched) throw new Error('expected fetched pilot')
    expect(fetched.id).toBe(created.id)
    expect(fetched.name).toBe(created.name)
    expect(fetched.callsign).toBe(created.callsign)
    expect(fetched.createdAt).toBe(created.createdAt)
    expect(fetched.updatedAt).toBe(created.updatedAt)
  })
})

describe('pilots CRUD — list ordering', () => {
  test('list returns pilots newest-first by createdAt', async () => {
    // Create three pilots with staggered timestamps
    const p1 = await pilots.create({ ...basePilotInput, name: 'Alpha' })
    await new Promise((r) => setTimeout(r, 5))
    const p2 = await pilots.create({ ...basePilotInput, name: 'Beta' })
    await new Promise((r) => setTimeout(r, 5))
    const p3 = await pilots.create({ ...basePilotInput, name: 'Gamma' })

    const all = await pilots.list()
    // Newest first
    expect(all.map((p) => p.id)).toEqual([p3.id, p2.id, p1.id])
  })
})

describe('pilots CRUD — update merge', () => {
  test('update merges patch and bumps updatedAt', async () => {
    const created = await pilots.create(basePilotInput)
    const originalUpdatedAt = created.updatedAt

    // Wait so updatedAt will differ
    await new Promise((r) => setTimeout(r, 5))

    const updated = await pilots.update(created.id, { name: 'New Name', callsign: 'Wraith' })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.callsign).toBe('Wraith')
    // Fields not in patch are preserved
    expect(updated.classRef).toBe(created.classRef)
    expect(updated.createdAt).toBe(created.createdAt)
    // updatedAt is bumped
    expect(updated.updatedAt).not.toBe(originalUpdatedAt)
  })

  test('update throws when id not found', async () => {
    await expect(pilots.update('nonexistent-id', { name: 'X' })).rejects.toThrow(
      '[itun-db] Cannot update'
    )
  })
})

describe('pilots CRUD — delete', () => {
  test('delete removes the record; subsequent get returns null', async () => {
    const created = await pilots.create(basePilotInput)
    await pilots.delete(created.id)
    const fetched = await pilots.get(created.id)
    expect(fetched).toBeNull()
  })

  test('delete is a silent no-op for unknown id', async () => {
    // Should not throw
    await pilots.delete('does-not-exist')
  })
})

describe('pilots CRUD — Zod rejection', () => {
  test('create rejects invalid input: missing required classRef', async () => {
    const bad = { ...basePilotInput } as Record<string, unknown>
    delete bad.classRef
    await expect(pilots.create(bad as Parameters<typeof pilots.create>[0])).rejects.toThrow()
  })

  test('create rejects unknown fields (schema strict)', async () => {
    await expect(
      pilots.create({
        ...basePilotInput,
        // @ts-expect-error — intentional bad input for test
        extraField: 'should fail',
      })
    ).rejects.toThrow()
  })
})
