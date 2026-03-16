import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from './index.js'
import type { SchemaToEntityMap } from './index.js'

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

describe('SalvageUnionReference.findUsagesOf', () => {
  it('should find chassis patterns that reference a known system by name', () => {
    // Pick a system that is known to appear in chassis patterns
    const allSystems = SalvageUnionReference.Systems.all()
    // Escape Hatch is a well-known system used in many chassis patterns
    const escapeHatch = allSystems.find((s) => s.name === 'Escape Hatch')
    expect(escapeHatch).toBeDefined()

    const usages = SalvageUnionReference.findUsagesOf('systems', escapeHatch!.id)
    // Chassis patterns reference systems by name, so this should find chassis
    expect(usages.length).toBeGreaterThan(0)
    for (const usage of usages) {
      expect(typeof usage.schemaName).toBe('string')
      expect(usage.entity).toBeDefined()
      expect(typeof usage.entity.id).toBe('string')
    }
  })

  it('should find chassis that use a given module by name', () => {
    const allModules = SalvageUnionReference.Modules.all()
    // Comms Module is a common module referenced in chassis patterns
    const commsModule = allModules.find((m) => m.name === 'Comms Module')
    expect(commsModule).toBeDefined()

    const usages = SalvageUnionReference.findUsagesOf('modules', commsModule!.id)
    expect(usages.length).toBeGreaterThan(0)
  })

  it('should return an empty array for an entity with no known usages', () => {
    // Use a non-existent ID
    const usages = SalvageUnionReference.findUsagesOf('systems', 'non-existent-id-xyz')
    expect(usages).toEqual([])
  })

  it('should not return the entity itself in its own usages', () => {
    const allSystems = SalvageUnionReference.Systems.all()
    const firstSystem = allSystems[0]!

    const usages = SalvageUnionReference.findUsagesOf('systems', firstSystem.id)
    for (const usage of usages) {
      expect(usage.entity.id).not.toBe(firstSystem.id)
    }
  })

  it('should tag usages with the schema name of the referencing entity', () => {
    const allSystems = SalvageUnionReference.Systems.all()
    const escapeHatch = allSystems.find((s) => s.name === 'Escape Hatch')!

    const usages = SalvageUnionReference.findUsagesOf('systems', escapeHatch.id)
    for (const usage of usages) {
      expect(typeof usage.schemaName).toBe('string')
      expect(usage.entity).toBeDefined()
    }
  })

  it('should find usages of an action by name in systems/modules that reference it', () => {
    // Systems reference actions by name in their actions array
    const allActions = SalvageUnionReference.Actions.all()
    const escapeHatchAction = allActions.find((a) => a.name === 'Escape Hatch')
    expect(escapeHatchAction).toBeDefined()

    const usages = SalvageUnionReference.findUsagesOf('actions', escapeHatchAction!.id)
    // Systems/modules should reference this action
    expect(usages.length).toBeGreaterThan(0)
  })

  it('should accept a schema name that is a valid SchemaToEntityMap key', () => {
    const schemaName: keyof SchemaToEntityMap = 'traits'
    const allTraits = SalvageUnionReference.Traits.all()
    const firstTrait = allTraits[0]!

    // Should not throw, even if there are no usages
    const usages = SalvageUnionReference.findUsagesOf(schemaName, firstTrait.id)
    expect(Array.isArray(usages)).toBe(true)
  })
})
