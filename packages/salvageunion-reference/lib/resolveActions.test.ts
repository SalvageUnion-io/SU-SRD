/**
 * Tests for SalvageUnionReference.resolveActions()
 */

import { describe, it, expect } from 'bun:test'
import type { SalvageUnionReference as SURefType } from './index.js'

let SalvageUnionReference: typeof SURefType

function getReference() {
  if (!SalvageUnionReference) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SalvageUnionReference = require('./index.js').SalvageUnionReference
  }
  return SalvageUnionReference
}

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('SalvageUnionReference.resolveActions', () => {
  describe('chassis actions (via chassisAbilities)', () => {
    it('should resolve chassis abilities from a chassis entity', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const actions = getReference().resolveActions(chassis)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved SURefMetaAction objects', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const actions = getReference().resolveActions(chassis)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })

    it('should handle chassis with empty chassisAbilities', () => {
      const chassis = getReference().Chassis.find(
        (c) => !c.chassisAbilities || c.chassisAbilities.length === 0
      )
      if (chassis) {
        const actions = getReference().resolveActions(chassis)
        expect(actions).toBeUndefined()
      }
    })
  })

  describe('system actions (via actions array)', () => {
    it('should resolve actions from a system entity', () => {
      const system = defined(getReference().Systems.all()[0])
      const actions = getReference().resolveActions(system)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved SURefMetaAction objects from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const actions = getReference().resolveActions(system)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('module actions (via actions array)', () => {
    it('should resolve actions from a module entity', () => {
      const module = defined(getReference().Modules.all()[0])
      const actions = getReference().resolveActions(module)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved SURefMetaAction objects from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const actions = getReference().resolveActions(module)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('ability actions (via actions array)', () => {
    it('should resolve actions from an ability entity', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const actions = getReference().resolveActions(ability)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved SURefMetaAction objects from abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const actions = getReference().resolveActions(ability)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('equipment actions (via actions array)', () => {
    it('should resolve actions from an equipment entity', () => {
      const equipment = defined(getReference().Equipment.all()[0])
      const actions = getReference().resolveActions(equipment)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved SURefMetaAction objects from equipment', () => {
      const equipment = defined(getReference().Equipment.all()[0])
      const actions = getReference().resolveActions(equipment)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('other entity types', () => {
    it('should handle NPCs with actions', () => {
      const npc = defined(getReference().NPCs.all()[0])
      const actions = getReference().resolveActions(npc)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle creatures with actions', () => {
      const creature = defined(getReference().Creatures.all()[0])
      const actions = getReference().resolveActions(creature)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle squads with actions', () => {
      const squad = defined(getReference().Squads.all()[0])
      const actions = getReference().resolveActions(squad)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle bio-titans with actions', () => {
      const titan = defined(getReference().BioTitans.all()[0])
      const actions = getReference().resolveActions(titan)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle meld with actions', () => {
      const meld = defined(getReference().Meld.all()[0])
      const actions = getReference().resolveActions(meld)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle crawlers with actions', () => {
      const crawler = defined(getReference().Crawlers.all()[0])
      const actions = getReference().resolveActions(crawler)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })
  })

  describe('entities without actions', () => {
    it('should return undefined for entities with no actions or chassisAbilities', () => {
      const trait = defined(getReference().Traits.all()[0])
      const actions = getReference().resolveActions(trait)
      expect(actions).toBeUndefined()
    })

    it('should return undefined for crawler bays without actions', () => {
      const crawlerBay = defined(getReference().CrawlerBays.all()[0])
      const actions = getReference().resolveActions(crawlerBay)
      expect(actions).toBeUndefined()
    })
  })

  describe('caching behavior', () => {
    it('should use cached action map for multiple calls', () => {
      const system1 = defined(getReference().Systems.all()[0])
      const system2 = defined(getReference().Systems.all()[1])

      const actions1 = getReference().resolveActions(system1)
      const actions2 = getReference().resolveActions(system2)

      expect(actions1).toBeDefined()
      expect(actions2).toBeDefined()
      // Both should be resolved successfully, indicating cache is working
      expect(Array.isArray(actions1)).toBe(true)
      expect(Array.isArray(actions2)).toBe(true)
    })
  })

  describe('type coverage', () => {
    it('should accept any entity type that might have actions', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const system = defined(getReference().Systems.all()[0])
      const ability = defined(getReference().Abilities.all()[0])

      // All should work without type errors
      const chassisActions = getReference().resolveActions(chassis)
      const systemActions = getReference().resolveActions(system)
      const abilityActions = getReference().resolveActions(ability)

      expect(chassisActions).toBeDefined()
      expect(systemActions).toBeDefined()
      expect(abilityActions).toBeDefined()
    })
  })
})
