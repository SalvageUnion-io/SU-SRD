/**
 * Test model metadata properties (schemaName and displayName)
 */

import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference, SchemaToDisplayName } from '../index'

describe('Model Metadata', () => {
  describe('schemaName property', () => {
    it('should return correct schema name for Abilities', () => {
      expect(SalvageUnionReference.Abilities.schemaName).toBe('abilities')
    })

    it('should return correct schema name for Equipment', () => {
      expect(SalvageUnionReference.Equipment.schemaName).toBe('equipment')
    })

    it('should return correct schema name for Modules', () => {
      expect(SalvageUnionReference.Modules.schemaName).toBe('modules')
    })

    it('should return correct schema name for Chassis', () => {
      expect(SalvageUnionReference.Chassis.schemaName).toBe('chassis')
    })

    it('should return correct schema name for Classes', () => {
      expect(SalvageUnionReference.Classes.schemaName).toBe('classes')
    })

    it('should return correct schema name for AbilityTreeRequirements', () => {
      expect(SalvageUnionReference.AbilityTreeRequirements.schemaName).toBe(
        'ability-tree-requirements'
      )
    })
  })

  describe('displayName property (singular)', () => {
    it('should return correct display name for Abilities', () => {
      expect(SalvageUnionReference.Abilities.displayName).toBe('Ability')
    })

    it('should return correct display name for Equipment', () => {
      expect(SalvageUnionReference.Equipment.displayName).toBe('Equipment')
    })

    it('should return correct display name for Modules', () => {
      expect(SalvageUnionReference.Modules.displayName).toBe('Module')
    })

    it('should return correct display name for Chassis', () => {
      expect(SalvageUnionReference.Chassis.displayName).toBe('Chassis')
    })

    it('should return correct display name for Classes', () => {
      expect(SalvageUnionReference.Classes.displayName).toBe('Class')
    })

    it('should return correct display name for AbilityTreeRequirements', () => {
      expect(SalvageUnionReference.AbilityTreeRequirements.displayName).toBe(
        'Ability Tree Requirement'
      )
    })
  })

  describe('SchemaToDisplayName map', () => {
    it('should be exported', () => {
      expect(SchemaToDisplayName).toBeDefined()
    })

    it('should have correct mapping for abilities', () => {
      expect(SchemaToDisplayName.abilities).toBe('Ability')
    })

    it('should have correct mapping for equipment', () => {
      expect(SchemaToDisplayName.equipment).toBe('Equipment')
    })

    it('should have correct mapping for modules', () => {
      expect(SchemaToDisplayName.modules).toBe('Module')
    })

    it('should have correct mapping for chassis', () => {
      expect(SchemaToDisplayName.chassis).toBe('Chassis')
    })

    it('should have correct mapping for classes', () => {
      expect(SchemaToDisplayName.classes).toBe('Class')
    })

    it('should have correct mapping for ability-tree-requirements', () => {
      expect(SchemaToDisplayName['ability-tree-requirements']).toBe('Ability Tree Requirement')
    })

    it('should have all schema names', () => {
      // Checked annotation: every listed id must be a real SchemaToDisplayName key
      const expectedSchemas: (keyof typeof SchemaToDisplayName)[] = [
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
        expect(SchemaToDisplayName[schema]).toBeDefined()
      }
    })
  })

  describe('Consistency between schemaName and SchemaToDisplayName', () => {
    it('should have matching schema names', () => {
      const schemaName = SalvageUnionReference.Abilities.schemaName
      const displayName = SalvageUnionReference.Abilities.displayName

      // Checked widening of the display-name literal union for the matcher
      const mapped: string = SchemaToDisplayName[schemaName as keyof typeof SchemaToDisplayName]
      expect(mapped).toBe(displayName)
    })

    it('should work for all models', () => {
      const models = [
        SalvageUnionReference.Abilities,
        SalvageUnionReference.Equipment,
        SalvageUnionReference.Modules,
        SalvageUnionReference.Chassis,
        SalvageUnionReference.Classes,
        SalvageUnionReference.Systems,
        SalvageUnionReference.Drones,
        SalvageUnionReference.Vehicles,
      ]

      for (const model of models) {
        const schemaName = model.schemaName
        const displayName = model.displayName

        // Checked widening of the display-name literal union for the matcher
        const mapped: string = SchemaToDisplayName[schemaName as keyof typeof SchemaToDisplayName]
        expect(mapped).toBe(displayName)
      }
    })
  })
})
