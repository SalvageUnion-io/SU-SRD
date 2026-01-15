/**
 * Test model metadata properties (schemaName and displayName)
 */

import { describe, expect, it } from 'vitest'
import { SchemaToDisplayName } from './index.js'

// Import SalvageUnionReference - use lazy getter to avoid initialization issues
import type { SalvageUnionReference as SURefType } from './index.js'
let SalvageUnionReference: typeof SURefType

function getReference() {
  if (!SalvageUnionReference) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SalvageUnionReference = require('./index.js').SalvageUnionReference
  }
  return SalvageUnionReference
}

describe('Model Metadata', () => {
  describe('schemaName property', () => {
    it('should return correct schema name for Abilities', () => {
      expect(getReference().Abilities.schemaName).toBe('abilities')
    })

    it('should return correct schema name for Equipment', () => {
      expect(getReference().Equipment.schemaName).toBe('equipment')
    })

    it('should return correct schema name for Modules', () => {
      expect(getReference().Modules.schemaName).toBe('modules')
    })

    it('should return correct schema name for Chassis', () => {
      expect(getReference().Chassis.schemaName).toBe('chassis')
    })

    it('should return correct schema name for Classes', () => {
      expect(getReference().Classes.schemaName).toBe('classes')
    })

    it('should return correct schema name for AbilityTreeRequirements', () => {
      expect(getReference().AbilityTreeRequirements.schemaName).toBe('ability-tree-requirements')
    })
  })

  describe('displayName property', () => {
    it('should return correct display name for Abilities', () => {
      expect(getReference().Abilities.displayName).toBe('Abilities')
    })

    it('should return correct display name for Equipment', () => {
      expect(getReference().Equipment.displayName).toBe('Equipment')
    })

    it('should return correct display name for Modules', () => {
      expect(getReference().Modules.displayName).toBe('Modules')
    })

    it('should return correct display name for Chassis', () => {
      expect(getReference().Chassis.displayName).toBe('Chassis')
    })

    it('should return correct display name for Classes', () => {
      expect(getReference().Classes.displayName).toBe('Classes')
    })

    it('should return correct display name for AbilityTreeRequirements', () => {
      expect(getReference().AbilityTreeRequirements.displayName).toBe('Ability Tree Requirements')
    })
  })

  describe('SchemaToDisplayName map', () => {
    it('should be exported', () => {
      expect(SchemaToDisplayName).toBeDefined()
    })

    it('should have correct mapping for abilities', () => {
      expect(SchemaToDisplayName.abilities).toBe('Abilities')
    })

    it('should have correct mapping for equipment', () => {
      expect(SchemaToDisplayName.equipment).toBe('Equipment')
    })

    it('should have correct mapping for modules', () => {
      expect(SchemaToDisplayName.modules).toBe('Modules')
    })

    it('should have correct mapping for chassis', () => {
      expect(SchemaToDisplayName.chassis).toBe('Chassis')
    })

    it('should have correct mapping for classes', () => {
      expect(SchemaToDisplayName['classes']).toBe('Classes')
    })

    it('should have correct mapping for ability-tree-requirements', () => {
      expect(SchemaToDisplayName['ability-tree-requirements']).toBe('Ability Tree Requirements')
    })

    it('should have all schema names', () => {
      const expectedSchemas = [
        'abilities',
        'ability-tree-requirements',
        'bio-titans',
        'chassis',
        'classes',
        'crawler-bays',
        'crawler-tech-levels',
        'crawlers',
        'creatures',
        'drones',
        'equipment',
        'keywords',
        'meld',
        'modules',
        'npcs',
        'roll-tables',
        'squads',
        'systems',
        'traits',
        'vehicles',
      ]

      for (const schema of expectedSchemas) {
        expect(SchemaToDisplayName[schema as keyof typeof SchemaToDisplayName]).toBeDefined()
      }
    })
  })

  describe('Consistency between schemaName and SchemaToDisplayName', () => {
    it('should have matching schema names', () => {
      const schemaName = getReference().Abilities.schemaName
      const displayName = getReference().Abilities.displayName

      expect(SchemaToDisplayName[schemaName as keyof typeof SchemaToDisplayName]).toBe(displayName)
    })

    it('should work for all models', () => {
      const models = [
        getReference().Abilities,
        getReference().Equipment,
        getReference().Modules,
        getReference().Chassis,
        getReference().Classes,
        getReference().Systems,
        getReference().Drones,
        getReference().Vehicles,
      ]

      for (const model of models) {
        const schemaName = model.schemaName
        const displayName = model.displayName

        expect(SchemaToDisplayName[schemaName as keyof typeof SchemaToDisplayName]).toBe(
          displayName
        )
      }
    })
  })
})
