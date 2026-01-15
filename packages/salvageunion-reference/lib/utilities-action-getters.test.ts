import { describe, expect, test } from 'bun:test'
import { getDataMaps } from './ModelFactory.js'

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
  getDescription,
  getActivationCost,
  getActionType,
  getRange,
  getDamage,
  getTraits,
  getChassisAbilities,
  getEffects,
  getTable,
  getOptions,
  getChoices,
  extractActions,
} from './utilities.js'

describe('Action Property Getters', () => {
  describe('getDescription', () => {
    test('should get description from ability', () => {
      const ability = getReference().Abilities.all()[0]!
      const description = getDescription(ability)
      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
    })

    test('should return undefined for non-ability entities (deprecated)', () => {
      const chassis = getReference().Chassis.all()[0]!
      const description = getDescription(chassis)
      expect(description).toBeUndefined()
    })
  })

  describe('getActivationCost', () => {
    test('should get activation cost from ability (action property)', () => {
      const ability = getReference()
        .Abilities.all()
        .find((a) => a.name === 'Ace Pilot')
      if (ability) {
        const cost = getActivationCost(ability)
        expect(cost).toBeDefined()
      }
    })

    test('should extract from action when action name matches entity name', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        activationCost?: number
      }>

      // Find an existing action with activationCost = 3
      const testAction = actionsData.find((a) => a.activationCost === 3)

      if (testAction && testAction.activationCost !== undefined) {
        // Entity name must match action name for extraction to work
        const entity = {
          id: 'test-matching-action',
          name: testAction.name, // Match action name
          actions: [testAction.name], // Use action name, not object
        }

        const cost = getActivationCost(entity as never)
        expect(cost).toBe(testAction.activationCost)
      }
    })

    test('should return undefined when action name does not match entity name', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        activationCost?: number
      }>
      const testAction = actionsData.find((a) => a.activationCost === 3)

      if (testAction) {
        const entity = {
          id: 'test-non-matching-action',
          name: 'Different Entity Name', // Different from action name
          actions: [testAction.name], // Use action name, not object
        }

        const cost = getActivationCost(entity as never)
        expect(cost).toBeUndefined()
      }
    })

    test('should prefer base-level property over matching action', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{ id: string; name: string }>
      const testAction = actionsData[0]

      if (testAction) {
        const entity = {
          id: 'test-base-level',
          name: 'Test Base Level',
          activationCost: 5,
          actions: [testAction.name], // Use action name, not object
        }

        const cost = getActivationCost(entity as never)
        expect(cost).toBe(5)
      }
    })

    test('should work correctly with real systems where action name matches entity name', () => {
      const systems = getReference().Systems.all()
      const systemWithMatchingAction = systems.find((s) => {
        if (!s.actions || s.actions.length === 0) return false
        const resolvedActions = extractActions(s)
        return resolvedActions?.some((action) => action.name === s.name)
      })
      if (systemWithMatchingAction) {
        const resolvedActions = extractActions(systemWithMatchingAction)
        const matchingAction = resolvedActions?.find(
          (action) => action.name === systemWithMatchingAction.name
        )
        const cost = getActivationCost(systemWithMatchingAction)
        if (matchingAction?.activationCost) {
          expect(cost).toBe(matchingAction.activationCost)
        }
      }
    })

    test('should extract from matching action when entity has multiple actions', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        activationCost?: number
      }>

      // Find an action with activationCost
      const matchingAction = actionsData.find((a) => a.activationCost === 3)
      const otherAction = actionsData.find(
        (a) => a.activationCost === 2 && a.name !== matchingAction?.name
      )

      if (matchingAction && matchingAction.activationCost !== undefined && otherAction) {
        // Entity has multiple actions, but one matches the entity name
        const entity = {
          id: 'test-multi-action',
          name: matchingAction.name, // Match one action name
          actions: [otherAction.name, matchingAction.name], // Multiple actions
        }

        const cost = getActivationCost(entity as never)
        expect(cost).toBe(matchingAction.activationCost)
      }
    })

    test('should return undefined when entity has multiple actions but none match entity name', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        activationCost?: number
      }>

      const action1 = actionsData.find((a) => a.activationCost === 2)
      const action2 = actionsData.find((a) => a.activationCost === 3 && a.name !== action1?.name)

      if (action1 && action2) {
        // Entity has multiple actions, but none match the entity name
        const entity = {
          id: 'test-multi-action-no-match',
          name: 'Different Entity Name', // Doesn't match any action name
          actions: [action1.name, action2.name], // Multiple actions
        }

        const cost = getActivationCost(entity as never)
        expect(cost).toBeUndefined()
      }
    })
  })

  describe('getActionType', () => {
    test('should get action type from ability (action property)', () => {
      const ability = getReference().Abilities.all()[0]!
      const actionType = getActionType(ability)
      expect(actionType).toBeDefined()
      expect(typeof actionType).toBe('string')
    })

    test('should extract from action when action name matches entity name', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        actionType?: string
      }>
      const testAction = actionsData.find((a) => a.actionType === 'Attack')

      if (testAction && testAction.actionType) {
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        actionType?: string
      }>
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        actionType?: string
      }>

      const matchingAction = actionsData.find((a) => a.actionType === 'Attack')
      const otherAction = actionsData.find(
        (a) => a.actionType === 'Reaction' && a.name !== matchingAction?.name
      )

      if (matchingAction && matchingAction.actionType && otherAction) {
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        range?: string[]
      }>
      const testAction = actionsData.find((a) => a.range && a.range.length > 0)

      if (testAction && testAction.range) {
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        range?: string[]
      }>
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        damage?: { damageType: string; amount: number }
      }>
      const testAction = actionsData.find((a) => a.damage)

      if (testAction && testAction.damage) {
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        damage?: { damageType: string; amount: number }
      }>
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
      const creature = getReference().Creatures.all()[0]!
      const traits = getTraits(creature)
      if (traits) {
        expect(Array.isArray(traits)).toBe(true)
      }
    })

    test('should extract from action when action name matches entity name', () => {
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        traits?: Array<{ type: string; amount?: number }>
      }>
      const testAction = actionsData.find((a) => a.traits && a.traits.length > 0)

      if (testAction && testAction.traits) {
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
      const { dataMap } = getDataMaps()
      const actionsData = dataMap['actions'] as Array<{
        id: string
        name: string
        traits?: Array<{ type: string; amount?: number }>
      }>
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

  describe('getEffects', () => {
    test('should get effects from ability (base level)', () => {
      const ability = getReference()
        .Abilities.all()
        .find((a) => {
          const effects = getEffects(a)
          return effects && effects.length > 0
        })
      if (ability) {
        const effects = getEffects(ability)
        expect(effects).toBeDefined()
        expect(Array.isArray(effects)).toBe(true)
        if (effects && effects.length > 0) {
          expect(effects[0]).toHaveProperty('value')
        }
      }
    })

    test('should return undefined when entity has no effects', () => {
      const entity = {
        id: 'test',
        name: 'Test',
        actions: [{ id: 'a1', name: 'A1' }],
      }
      expect(getEffects(entity as never)).toBeUndefined()
    })
  })

  describe('getTable', () => {
    test('should get table from crawler bay (base level)', () => {
      const crawlerBay = getReference()
        .CrawlerBays.all()
        .find((cb) => {
          const table = getTable(cb)
          return table !== undefined
        })
      if (crawlerBay) {
        const table = getTable(crawlerBay)
        expect(table).toBeDefined()
        expect(table).toHaveProperty('type')
      }
    })

    test('should get table from tableName reference in crawler bay', () => {
      const tradingBay = getReference()
        .CrawlerBays.all()
        .find((cb) => 'tableName' in cb && cb.tableName === 'Trading Bay')
      if (tradingBay) {
        const table = getTable(tradingBay)
        expect(table).toBeDefined()
        expect(table).toHaveProperty('type')
        // Verify it's the correct table by checking for expected entries
        expect(table).toHaveProperty('1')
        expect(table).toHaveProperty('20')
      }
    })

    test('should get table from tableName reference in action', () => {
      const mechapultAction = getReference()
        .Actions.all()
        .find((a) => 'tableName' in a && a.tableName === 'Mechapult')
      if (mechapultAction) {
        const table = getTable(mechapultAction)
        expect(table).toBeDefined()
        expect(table).toHaveProperty('type')
        // Verify it's the correct table by checking for expected entries
        expect(table).toHaveProperty('1')
        expect(table).toHaveProperty('20')
      }
    })
  })

  describe('getOptions', () => {
    test('should get options from ability (action property)', () => {
      const ability = getReference()
        .Abilities.all()
        .find((a) => {
          const options = getOptions(a)
          return options && options.length > 0
        })
      if (ability) {
        const options = getOptions(ability)
        expect(options).toBeDefined()
        expect(Array.isArray(options)).toBe(true)
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
})
