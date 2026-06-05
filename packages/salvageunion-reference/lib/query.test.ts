/**
 * Tests for query helper functions
 */

import { describe, it, expect } from 'bun:test'
import { isValidSchemaName, filterByTechLevel, filterBySource } from './query.js'
import { SalvageUnionReference } from './index.js'
import type { SURefEnumSchemaName } from './types/index.js'

describe('isValidSchemaName', () => {
  it('should return true for valid schema names', () => {
    const validNames: SURefEnumSchemaName[] = [
      'abilities',
      'chassis',
      'systems',
      'modules',
      'equipment',
      'crawlers',
      'drones',
      'vehicles',
    ]

    for (const name of validNames) {
      expect(isValidSchemaName(name)).toBe(true)
    }
  })

  it('should return false for invalid schema names', () => {
    const invalidNames = ['invalid', 'chassis-system', 'not-a-schema', '']

    for (const name of invalidNames) {
      expect(isValidSchemaName(name)).toBe(false)
    }
  })

  it('should narrow type correctly in conditional blocks', () => {
    const unknownName: string = 'equipment'

    if (isValidSchemaName(unknownName)) {
      // unknownName should be narrowed to SURefEnumSchemaName here
      const entities = SalvageUnionReference.findAllIn(unknownName, () => true)
      expect(Array.isArray(entities)).toBe(true)
    }
  })

  it('should work with all entity schema names', () => {
    const entitySchemaNames: SURefEnumSchemaName[] = [
      'abilities',
      'ability-tree-requirements',
      'bio-titans',
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
      'sources',
      'squads',
      'systems',
      'tech-levels',
      'traits',
      'vehicles',
    ]

    for (const name of entitySchemaNames) {
      expect(isValidSchemaName(name)).toBe(true)
    }
  })
})

describe('filterByTechLevel', () => {
  it('should return all entities with matching tech level', () => {
    const results = filterByTechLevel('equipment', 1)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)

    // All results should have techLevel of 1
    for (const item of results) {
      expect((item as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should return empty array for non-matching tech level', () => {
    const results = filterByTechLevel('equipment', 99)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should work with systems', () => {
    const results = filterByTechLevel('systems', 1)
    expect(Array.isArray(results)).toBe(true)
    // Systems should have tech level data
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should work with modules', () => {
    const results = filterByTechLevel('modules', 1)
    expect(Array.isArray(results)).toBe(true)
    // Modules should have tech level data
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should work with chassis', () => {
    const results = filterByTechLevel('chassis', 1)
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should work with drones', () => {
    const results = filterByTechLevel('drones', 1)
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should work with vehicles', () => {
    const results = filterByTechLevel('vehicles', 1)
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).techLevel).toBe(1)
    }
  })

  it('should include schemaName in returned entities', () => {
    const results = filterByTechLevel('equipment', 1)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).schemaName).toBe('equipment')
    }
  })
})

describe('filterBySource', () => {
  it('should return all entities matching source', () => {
    const results = filterBySource('equipment', 'Salvage Union Workshop Manual')
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)

    // All results should have matching source
    for (const item of results) {
      expect((item as unknown as Record<string, unknown>).source).toBe(
        'Salvage Union Workshop Manual'
      )
    }
  })

  it('should return empty array for non-matching source', () => {
    const results = filterBySource('equipment', 'Non-existent Source')
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should work with systems', () => {
    const results = filterBySource('systems', 'Salvage Union Workshop Manual')
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).source).toBe(
        'Salvage Union Workshop Manual'
      )
    }
  })

  it('should work with modules', () => {
    const results = filterBySource('modules', 'Salvage Union Workshop Manual')
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).source).toBe(
        'Salvage Union Workshop Manual'
      )
    }
  })

  it('should work with abilities', () => {
    const results = filterBySource('abilities', 'Salvage Union Workshop Manual')
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).source).toBe(
        'Salvage Union Workshop Manual'
      )
    }
  })

  it('should work with chassis', () => {
    const results = filterBySource('chassis', 'Salvage Union Workshop Manual')
    expect(Array.isArray(results)).toBe(true)
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).source).toBe(
        'Salvage Union Workshop Manual'
      )
    }
  })

  it('should work with different sources', () => {
    const allEquipment = SalvageUnionReference.Equipment.all()
    const sources = [
      ...new Set(allEquipment.map((e: unknown) => (e as Record<string, unknown>).source)),
    ]

    for (const source of sources) {
      const results = filterBySource('equipment', source as string)
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      for (const item of results) {
        expect((item as unknown as Record<string, unknown>).source).toBe(source)
      }
    }
  })

  it('should include schemaName in returned entities', () => {
    const results = filterBySource('equipment', 'Salvage Union Workshop Manual')
    if (results.length > 0) {
      expect((results[0] as unknown as Record<string, unknown>).schemaName).toBe('equipment')
    }
  })
})
