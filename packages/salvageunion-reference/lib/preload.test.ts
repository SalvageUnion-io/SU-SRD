/**
 * Tests for SalvageUnionReference.preload() and isLoaded() API
 *
 * These tests exercise the lazy loading contract:
 * - preload('all') loads every schema
 * - preload(['chassis', 'classes']) loads specific schemas
 * - isLoaded(id) reports load status correctly
 * - Accessing an unloaded schema throws a descriptive error
 * - preload() is idempotent (calling twice is safe)
 * - After preload, all ORM methods work synchronously as before
 */

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { SalvageUnionReference, resetAllForTesting } from './index.js'
import { BaseModel } from './BaseModel.js'

// After all preload tests complete, restore the global preload state so
// other test files that run after this one see loaded schemas.
afterAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('SalvageUnionReference.isLoaded', () => {
  beforeEach(() => {
    resetAllForTesting()
  })

  it('returns false for an unloaded schema', () => {
    expect(SalvageUnionReference.isLoaded('chassis')).toBe(false)
  })

  it('returns false for all schemas before any preload', () => {
    const schemaIds = [
      'abilities',
      'chassis',
      'classes',
      'systems',
      'modules',
      'equipment',
      'creatures',
    ]
    for (const id of schemaIds) {
      expect(SalvageUnionReference.isLoaded(id)).toBe(false)
    }
  })

  it('returns true after preloading a specific schema', async () => {
    await SalvageUnionReference.preload(['chassis'])
    expect(SalvageUnionReference.isLoaded('chassis')).toBe(true)
  })

  it('returns false for schemas not included in a partial preload', async () => {
    await SalvageUnionReference.preload(['chassis'])
    expect(SalvageUnionReference.isLoaded('abilities')).toBe(false)
  })

  it('returns true for all schemas after preload("all")', async () => {
    await SalvageUnionReference.preload('all')
    const schemaIds = [
      'abilities',
      'ability-tree-requirements',
      'bio-titans',
      'actions',
      'chassis',
      'classes',
      'crawler-bays',
      'crawler-tech-levels',
      'crawlers',
      'creatures',
      'distances',
      'drones',
      'equipment',
      'factions',
      'guides',
      'keywords',
      'meld',
      'modules',
      'npcs',
      'roll-tables',
      'squads',
      'systems',
      'traits',
      'vehicles',
      'sources',
      'tech-levels',
      'catalog-categories',
    ]
    for (const id of schemaIds) {
      expect(SalvageUnionReference.isLoaded(id)).toBe(true)
    }
  })
})

describe('SalvageUnionReference.preload — specific schemas', () => {
  beforeEach(() => {
    resetAllForTesting()
  })

  it('loads only the requested schemas', async () => {
    await SalvageUnionReference.preload(['chassis', 'classes'])
    expect(SalvageUnionReference.isLoaded('chassis')).toBe(true)
    expect(SalvageUnionReference.isLoaded('classes')).toBe(true)
    expect(SalvageUnionReference.isLoaded('abilities')).toBe(false)
  })

  it('returns a Promise that resolves to void', async () => {
    const result = await SalvageUnionReference.preload(['chassis'])
    expect(result).toBeUndefined()
  })

  it('makes the model accessible as a BaseModel after preload', async () => {
    await SalvageUnionReference.preload(['chassis'])
    expect(SalvageUnionReference.Chassis).toBeInstanceOf(BaseModel)
  })

  it('makes .all() return a non-empty array after preload', async () => {
    await SalvageUnionReference.preload(['chassis'])
    const all = SalvageUnionReference.Chassis.all()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(0)
  })

  it('makes .find() work after preload', async () => {
    await SalvageUnionReference.preload(['chassis'])
    const chassis = SalvageUnionReference.Chassis.find(() => true)
    expect(chassis).toBeDefined()
  })

  it('makes .findAll() work after preload', async () => {
    await SalvageUnionReference.preload(['chassis'])
    const results = SalvageUnionReference.Chassis.findAll(() => true)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  it('populates the static model property on the class', async () => {
    await SalvageUnionReference.preload(['abilities'])
    const abilities = SalvageUnionReference.Abilities.all()
    expect(abilities.length).toBeGreaterThan(0)
  })
})

describe('SalvageUnionReference.preload("all")', () => {
  beforeEach(() => {
    resetAllForTesting()
  })

  it('loads all schemas and allows access to every model', async () => {
    await SalvageUnionReference.preload('all')

    // Spot-check several models
    expect(SalvageUnionReference.Chassis.all().length).toBeGreaterThan(0)
    expect(SalvageUnionReference.Abilities.all().length).toBeGreaterThan(0)
    expect(SalvageUnionReference.Systems.all().length).toBeGreaterThan(0)
    expect(SalvageUnionReference.Equipment.all().length).toBeGreaterThan(0)
    expect(SalvageUnionReference.NPCs.all().length).toBeGreaterThan(0)
  })

  it('all models are BaseModel instances after preload("all")', async () => {
    await SalvageUnionReference.preload('all')

    const modelProps = [
      'Abilities',
      'Chassis',
      'Classes',
      'Systems',
      'Modules',
      'Equipment',
      'NPCs',
      'Creatures',
      'Vehicles',
      'Drones',
      'RollTables',
      'Guides',
    ]
    for (const prop of modelProps) {
      const model = SalvageUnionReference[prop as keyof typeof SalvageUnionReference]
      expect(model).toBeInstanceOf(BaseModel)
    }
  })
})

describe('SalvageUnionReference.preload — idempotency', () => {
  beforeEach(() => {
    resetAllForTesting()
  })

  it('calling preload twice with same schemas does not throw', async () => {
    await SalvageUnionReference.preload(['chassis'])
    await expect(SalvageUnionReference.preload(['chassis'])).resolves.toBeUndefined()
  })

  it('calling preload("all") twice does not throw', async () => {
    await SalvageUnionReference.preload('all')
    await expect(SalvageUnionReference.preload('all')).resolves.toBeUndefined()
  })

  it('data is unchanged after a redundant preload call', async () => {
    await SalvageUnionReference.preload(['chassis'])
    const countFirst = SalvageUnionReference.Chassis.all().length

    await SalvageUnionReference.preload(['chassis'])
    const countSecond = SalvageUnionReference.Chassis.all().length

    expect(countFirst).toBe(countSecond)
  })

  it('can extend loaded schemas incrementally', async () => {
    await SalvageUnionReference.preload(['chassis'])
    expect(SalvageUnionReference.isLoaded('chassis')).toBe(true)
    expect(SalvageUnionReference.isLoaded('abilities')).toBe(false)

    await SalvageUnionReference.preload(['abilities'])
    expect(SalvageUnionReference.isLoaded('chassis')).toBe(true)
    expect(SalvageUnionReference.isLoaded('abilities')).toBe(true)
  })
})

describe('SalvageUnionReference — access before preload throws', () => {
  beforeEach(() => {
    resetAllForTesting()
  })

  it('throws a descriptive error when accessing .all() on unloaded model', () => {
    expect(() => SalvageUnionReference.Chassis.all()).toThrow(/Schema "chassis" not loaded/)
  })

  it('throws a descriptive error containing schema name', () => {
    expect(() => SalvageUnionReference.Abilities.all()).toThrow(/abilities/)
  })

  it('error message mentions preload()', () => {
    expect(() => SalvageUnionReference.Systems.all()).toThrow(/preload/)
  })

  it('throws when calling .find() on unloaded model', () => {
    expect(() => SalvageUnionReference.Equipment.find(() => true)).toThrow(
      /Schema "equipment" not loaded/
    )
  })

  it('throws when calling .findAll() on unloaded model', () => {
    expect(() => SalvageUnionReference.Modules.findAll(() => true)).toThrow(
      /Schema "modules" not loaded/
    )
  })
})
