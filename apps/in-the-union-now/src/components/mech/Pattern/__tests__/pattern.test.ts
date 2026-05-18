/**
 * Tests for MechPattern schema and db.mechPatterns CRUD (AC-1, AC-2, #192).
 *
 * Covers:
 * - Schema validation: valid input passes, missing required fields throw
 * - Schema strictness: unknown fields throw
 * - db.mechPatterns CRUD round-trip: create → get → list → delete
 * - Instantiate path: pattern fields copied to new mech with fresh id + timestamps
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * No mock.module() — no global leak risk.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { MechPatternSchema } from '../../../../lib/schemas/pattern'
import { mechPatterns, mechs, _clearAllStores, _resetDbSingleton } from '../../../../lib/db/index'

// ---------------------------------------------------------------------------
// DB reset between tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
})

afterEach(async () => {
  await _clearAllStores()
})

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

const validPatternBase = {
  schemaVersion: 1 as const,
  name: 'Scout Loadout',
  chassisRef: 'mule',
  systems: ['targeting-system'],
  modules: ['armor-plating'],
  cargo: ['medkit'],
}

describe('MechPatternSchema — valid input', () => {
  test('parses a fully valid pattern', () => {
    const result = MechPatternSchema.safeParse({
      id: 'pattern-1',
      createdAt: new Date().toISOString(),
      ...validPatternBase,
    })
    expect(result.success).toBe(true)
  })

  test('accepts empty arrays for systems, modules, cargo', () => {
    const result = MechPatternSchema.safeParse({
      id: 'pattern-2',
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      name: 'Bare Chassis',
      chassisRef: 'iron-mongrel',
      systems: [],
      modules: [],
      cargo: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('MechPatternSchema — invalid input', () => {
  test('rejects missing name', () => {
    const withoutName: Record<string, unknown> = { ...validPatternBase }
    delete withoutName['name']
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: new Date().toISOString(),
      ...withoutName,
    })
    expect(result.success).toBe(false)
  })

  test('rejects empty name (min length 1)', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: new Date().toISOString(),
      ...validPatternBase,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing chassisRef', () => {
    const withoutChassisRef: Record<string, unknown> = { ...validPatternBase }
    delete withoutChassisRef['chassisRef']
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: new Date().toISOString(),
      ...withoutChassisRef,
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing id', () => {
    const result = MechPatternSchema.safeParse({
      createdAt: new Date().toISOString(),
      ...validPatternBase,
    })
    expect(result.success).toBe(false)
  })

  test('rejects unknown fields (.strict())', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: new Date().toISOString(),
      ...validPatternBase,
      unknownField: 'should fail',
    })
    expect(result.success).toBe(false)
  })

  test('rejects wrong schemaVersion', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: new Date().toISOString(),
      ...validPatternBase,
      schemaVersion: 2,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// db.mechPatterns CRUD round-trip
// ---------------------------------------------------------------------------

describe('db.mechPatterns — create + get round-trip', () => {
  test('create returns a pattern with a generated id and createdAt', async () => {
    const created = await mechPatterns.create(validPatternBase)

    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.name).toBe('Scout Loadout')
    expect(created.chassisRef).toBe('mule')
    expect(created.systems).toEqual(['targeting-system'])
    expect(created.schemaVersion).toBe(1)
    expect(typeof created.createdAt).toBe('string')
  })

  test('get retrieves the created pattern by id', async () => {
    const created = await mechPatterns.create(validPatternBase)
    const fetched = await mechPatterns.get(created.id)

    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
    expect(fetched!.name).toBe(created.name)
    expect(fetched!.createdAt).toBe(created.createdAt)
  })

  test('get returns null for a non-existent id', async () => {
    const result = await mechPatterns.get('does-not-exist')
    expect(result).toBeNull()
  })
})

describe('db.mechPatterns — list', () => {
  test('list returns all patterns, newest first', async () => {
    const p1 = await mechPatterns.create({ ...validPatternBase, name: 'Alpha' })
    await new Promise((r) => setTimeout(r, 5))
    const p2 = await mechPatterns.create({ ...validPatternBase, name: 'Beta' })

    const all = await mechPatterns.list()
    expect(all.length).toBe(2)
    expect(all[0]!.id).toBe(p2.id) // newest first
    expect(all[1]!.id).toBe(p1.id)
  })

  test('list returns empty array when no patterns exist', async () => {
    const all = await mechPatterns.list()
    expect(all).toEqual([])
  })
})

describe('db.mechPatterns — delete', () => {
  test('delete removes the pattern; subsequent get returns null', async () => {
    const created = await mechPatterns.create(validPatternBase)
    await mechPatterns.delete(created.id)
    const fetched = await mechPatterns.get(created.id)
    expect(fetched).toBeNull()
  })

  test('delete is a silent no-op for an unknown id', async () => {
    // Should not throw
    await mechPatterns.delete('does-not-exist')
  })
})

describe('db.mechPatterns — Zod rejection', () => {
  test('create rejects a pattern with an empty name', async () => {
    await expect(mechPatterns.create({ ...validPatternBase, name: '' })).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Instantiate path: pattern → fresh mech (AC-2)
// ---------------------------------------------------------------------------

describe('instantiate from pattern — fresh mech with pattern fields', () => {
  test('mech created from pattern has a new id and fresh timestamps', async () => {
    const pattern = await mechPatterns.create({
      schemaVersion: 1,
      name: 'Heavy Hauler',
      chassisRef: 'mule',
      systems: ['sys-a', 'sys-b'],
      modules: ['mod-x'],
      cargo: ['fuel-cell'],
    })

    // Simulate a small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 5))

    // Instantiate: create a fresh mech from the pattern's fields
    const mech = await mechs.create({
      schemaVersion: 1,
      name: `${pattern.name} (from pattern)`,
      chassisRef: pattern.chassisRef,
      systems: [...pattern.systems],
      modules: [...pattern.modules],
      cargo: [...pattern.cargo],
      conditions: [],
    })

    // Fresh identity — not the same id as the pattern
    expect(mech.id).not.toBe(pattern.id)

    // Timestamps are fresh
    expect(new Date(mech.createdAt).getTime()).toBeGreaterThan(
      new Date(pattern.createdAt).getTime()
    )

    // Pattern fields are copied verbatim
    expect(mech.chassisRef).toBe(pattern.chassisRef)
    expect(mech.systems).toEqual(pattern.systems)
    expect(mech.modules).toEqual(pattern.modules)
    expect(mech.cargo).toEqual(pattern.cargo)

    // Name convention
    expect(mech.name).toBe('Heavy Hauler (from pattern)')

    // Pattern itself is unmodified
    const refetched = await mechPatterns.get(pattern.id)
    expect(refetched).not.toBeNull()
    expect(refetched!.id).toBe(pattern.id)
  })
})
