import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from './index.js'

describe('SalvageUnionReference.getAllBySchemaNames', () => {
  it('should return tagged results for a single schema', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['abilities'])
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(result.schemaName).toBe('abilities')
      expect(result.entity).toBeDefined()
      expect(typeof result.entity.id).toBe('string')
    }
  })

  it('should return tagged results for multiple schemas', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['systems', 'modules'])
    expect(results.length).toBeGreaterThan(0)

    const schemaNames = new Set(results.map((r) => r.schemaName))
    expect(schemaNames.has('systems')).toBe(true)
    expect(schemaNames.has('modules')).toBe(true)
  })

  it('should tag each entity with the correct schema name', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['chassis', 'creatures'])
    const chassisResults = results.filter((r) => r.schemaName === 'chassis')
    const creatureResults = results.filter((r) => r.schemaName === 'creatures')

    expect(chassisResults.length).toBeGreaterThan(0)
    expect(creatureResults.length).toBeGreaterThan(0)

    const allChassis = SalvageUnionReference.Chassis.all()
    const allCreatures = SalvageUnionReference.Creatures.all()
    expect(chassisResults.length).toBe(allChassis.length)
    expect(creatureResults.length).toBe(allCreatures.length)
  })

  it('should return an empty array for an empty schema list', () => {
    const results = SalvageUnionReference.getAllBySchemaNames([])
    expect(results).toEqual([])
  })

  it('should include all entities from each schema without duplicates', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['systems'])
    const allSystems = SalvageUnionReference.Systems.all()
    expect(results.length).toBe(allSystems.length)

    const ids = results.map((r) => r.entity.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should work with meta schemas', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['actions'])
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(result.schemaName).toBe('actions')
    }
  })

  it('should return entities with their name field accessible', () => {
    const results = SalvageUnionReference.getAllBySchemaNames(['traits'])
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect(typeof (result.entity as { name: string }).name).toBe('string')
    }
  })
})
