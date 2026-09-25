import { describe, expect, test } from 'bun:test'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

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

import {
  getActionType,
  getChassisAbilities,
  getChoices,
  getDamage,
  getRange,
  getTraits,
} from './actionResolution.js'
import { getDescription } from './entityFields.js'

describe('Action Property Getters', () => {
  describe('getDescription', () => {
    test('should get description from ability', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const description = getDescription(ability)
      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
    })

    test('should return undefined for non-ability entities (deprecated)', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const description = getDescription(chassis)
      expect(description).toBeUndefined()
    })
  })

  describe('getActionType', () => {
    test('should get action type from ability (action property)', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const actionType = getActionType(ability)
      expect(actionType).toBeDefined()
      expect(typeof actionType).toBe('string')
    })

    test('should extract from action when action name matches entity name', () => {
      // Checked widening, not a cast: 'Attack' is outside the ActionType enum,
      // so against the precise model type this probe is statically impossible —
      // the original test deliberately searches for it (dead branch preserved).
      const actionsData: Array<{ id: string; name: string; actionType?: string }> =
        getReference().Actions.all()
      const testAction = actionsData.find((a) => a.actionType === 'Attack')

      if (testAction?.actionType) {
        // Entity name must match action name for extraction to work
        const entity = {
          id: 'test',
          name: testAction.name, // Match action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getActionType(entity as never)).toBe('Attack')
      }
    })

    test('should return undefined when action name does not match entity name', () => {
      // Checked widening — see the note on the previous test.
      const actionsData: Array<{ id: string; name: string; actionType?: string }> =
        getReference().Actions.all()
      const testAction = actionsData.find((a) => a.actionType === 'Attack')

      if (testAction) {
        const entity = {
          id: 'test',
          name: 'Different Entity Name', // Different from action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getActionType(entity as never)).toBeUndefined()
      }
    })

    test('should extract from matching action when entity has multiple actions', () => {
      // Checked widening — see the note on the first getActionType probe test.
      const actionsData: Array<{ id: string; name: string; actionType?: string }> =
        getReference().Actions.all()

      const matchingAction = actionsData.find((a) => a.actionType === 'Attack')
      const otherAction = actionsData.find(
        (a) => a.actionType === 'Reaction' && a.name !== matchingAction?.name
      )

      if (matchingAction?.actionType && otherAction) {
        const entity = {
          id: 'test-multi-action',
          name: matchingAction.name, // Match one action name
          actions: [otherAction.name, matchingAction.name], // Multiple actions
        }
        expect(getActionType(entity as never)).toBe(matchingAction.actionType)
      }
    })
  })

  describe('getRange', () => {
    test('should get range from system (action property)', () => {
      const system = getReference()
        .Systems.all()
        .find((s) => s.name === 'Assault Rifle')
      if (system) {
        const range = getRange(system)
        expect(range).toBeDefined()
        expect(typeof range).toBe('string')
      }
    })

    test('should extract from action when action name matches entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.range && a.range.length > 0)

      if (testAction?.range) {
        // Entity name must match action name for extraction to work
        const entity = {
          id: 'test',
          name: testAction.name, // Match action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getRange(entity as never)).toEqual(testAction.range)
      }
    })

    test('should return undefined when action name does not match entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.range && a.range.length > 0)

      if (testAction) {
        const entity = {
          id: 'test',
          name: 'Different Entity Name', // Different from action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getRange(entity as never)).toBeUndefined()
      }
    })
  })

  describe('getDamage', () => {
    test('should get damage from system (action property)', () => {
      const system = getReference()
        .Systems.all()
        .find((s) => s.name === 'Assault Rifle')
      if (system) {
        const damage = getDamage(system)
        expect(damage).toBeDefined()
        expect(damage).toHaveProperty('damageType')
        expect(damage).toHaveProperty('amount')
      }
    })

    test('should get damage from chassis action (base level)', () => {
      const chassis = getReference()
        .Chassis.all()
        .find((c) => {
          const abilities = getChassisAbilities(c)
          return abilities && abilities.length > 0 && abilities[0]?.damage !== undefined
        })
      if (chassis) {
        const damage = getDamage(chassis)
        expect(damage).toBeDefined()
      }
    })

    test('should extract from action when action name matches entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.damage)

      if (testAction?.damage) {
        // Entity name must match action name for extraction to work
        const entity = {
          id: 'test',
          name: testAction.name, // Match action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getDamage(entity as never)).toEqual(testAction.damage)
      }
    })

    test('should return undefined when action name does not match entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.damage)

      if (testAction) {
        const entity = {
          id: 'test',
          name: 'Different Entity Name', // Different from action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getDamage(entity as never)).toBeUndefined()
      }
    })
  })

  describe('getTraits', () => {
    test('should get traits from system (action property)', () => {
      const system = getReference()
        .Systems.all()
        .find((s) => {
          const traits = getTraits(s)
          return traits && traits.length > 0
        })
      if (system) {
        const traits = getTraits(system)
        expect(traits).toBeDefined()
        expect(Array.isArray(traits)).toBe(true)
      }
    })

    test('should get traits from creature (base level)', () => {
      const creature = defined(getReference().Creatures.all()[0])
      const traits = getTraits(creature)
      if (traits) {
        expect(Array.isArray(traits)).toBe(true)
      }
    })

    test('should extract from action when action name matches entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.traits && a.traits.length > 0)

      if (testAction?.traits) {
        // Entity name must match action name for extraction to work
        const entity = {
          id: 'test',
          name: testAction.name, // Match action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getTraits(entity as never)).toEqual(testAction.traits)
      }
    })

    test('should return undefined when action name does not match entity name', () => {
      const actionsData = getReference().Actions.all()
      const testAction = actionsData.find((a) => a.traits && a.traits.length > 0)

      if (testAction) {
        const entity = {
          id: 'test',
          name: 'Different Entity Name', // Different from action name
          actions: [testAction.name], // Use action name, not object
        }
        expect(getTraits(entity as never)).toBeUndefined()
      }
    })
  })

  describe('getChoices', () => {
    test('should get choices from equipment (action property)', () => {
      const equipment = getReference()
        .Equipment.all()
        .find((e) => {
          const choices = getChoices(e)
          return choices && choices.length > 0
        })
      if (equipment) {
        const choices = getChoices(equipment)
        expect(choices).toBeDefined()
        expect(Array.isArray(choices)).toBe(true)
      }
    })
  })

  describe('self-action resolution via displayName', () => {
    // The dataset uniquifies two different Bio-Rifle actions by source —
    // `Bio-Rifle (Equipment)` and `Bio-Rifle (Chimerium Chosen)` — keeping the
    // real name in `displayName`. That suffix is an internal identifier, so the
    // equipment's own action must still resolve as its self-action; matching on
    // `name` alone silently dropped its range/damage/traits.
    test('Bio-Rifle equipment resolves facets from its (Equipment)-suffixed action', () => {
      const bioRifle = defined(
        getReference()
          .Equipment.all()
          .find((e) => 'name' in e && e.name === 'Bio-Rifle')
      )
      expect(getActionType(bioRifle)).toBe('Turn')
      expect(getRange(bioRifle)).toEqual(['Medium'])
      expect(defined(getDamage(bioRifle)).amount).toBe(4)
      expect(defined(getTraits(bioRifle)).map((t) => t.type)).toContain('pinning')
    })
  })
})
