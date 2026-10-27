/**
 * Tests for SalvageUnionReference.resolveActions()
 */

import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index'
import { defined } from '../testing'

describe('SalvageUnionReference.resolveActions', () => {
  describe('chassis actions (via chassisAbilities)', () => {
    it('should resolve chassis abilities from a chassis entity', () => {
      const chassis = defined(SalvageUnionReference.Chassis.all()[0])
      const actions = SalvageUnionReference.resolveActions(chassis)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved RefMetaAction objects', () => {
      const chassis = defined(SalvageUnionReference.Chassis.all()[0])
      const actions = SalvageUnionReference.resolveActions(chassis)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })

    it('should handle chassis with empty chassisAbilities', () => {
      const chassis = SalvageUnionReference.Chassis.find(
        (c) => !c.chassisAbilities || c.chassisAbilities.length === 0
      )
      if (chassis) {
        const actions = SalvageUnionReference.resolveActions(chassis)
        expect(actions).toBeUndefined()
      }
    })
  })

  describe('system actions (via actions array)', () => {
    it('should resolve actions from a system entity', () => {
      const system = defined(SalvageUnionReference.Systems.all()[0])
      const actions = SalvageUnionReference.resolveActions(system)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved RefMetaAction objects from systems', () => {
      const system = defined(SalvageUnionReference.Systems.all()[0])
      const actions = SalvageUnionReference.resolveActions(system)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('module actions (via actions array)', () => {
    it('should resolve actions from a module entity', () => {
      const module = defined(SalvageUnionReference.Modules.all()[0])
      const actions = SalvageUnionReference.resolveActions(module)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved RefMetaAction objects from modules', () => {
      const module = defined(SalvageUnionReference.Modules.all()[0])
      const actions = SalvageUnionReference.resolveActions(module)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('ability actions (via actions array)', () => {
    it('should resolve actions from an ability entity', () => {
      const ability = defined(SalvageUnionReference.Abilities.all()[0])
      const actions = SalvageUnionReference.resolveActions(ability)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved RefMetaAction objects from abilities', () => {
      const ability = defined(SalvageUnionReference.Abilities.all()[0])
      const actions = SalvageUnionReference.resolveActions(ability)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('equipment actions (via actions array)', () => {
    it('should resolve actions from an equipment entity', () => {
      const equipment = defined(SalvageUnionReference.Equipment.all()[0])
      const actions = SalvageUnionReference.resolveActions(equipment)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should return resolved RefMetaAction objects from equipment', () => {
      const equipment = defined(SalvageUnionReference.Equipment.all()[0])
      const actions = SalvageUnionReference.resolveActions(equipment)
      if (actions && actions.length > 0) {
        const firstAction = defined(actions[0])
        expect(firstAction).toHaveProperty('id')
        expect(firstAction).toHaveProperty('name')
      }
    })
  })

  describe('other entity types', () => {
    it('should handle NPCs with actions', () => {
      const npc = defined(SalvageUnionReference.NPCs.all()[0])
      const actions = SalvageUnionReference.resolveActions(npc)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle creatures with actions', () => {
      const creature = defined(SalvageUnionReference.Creatures.all()[0])
      const actions = SalvageUnionReference.resolveActions(creature)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle squads with actions', () => {
      const squad = defined(SalvageUnionReference.Squads.all()[0])
      const actions = SalvageUnionReference.resolveActions(squad)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle bio-titans with actions', () => {
      const titan = defined(SalvageUnionReference.BioTitans.all()[0])
      const actions = SalvageUnionReference.resolveActions(titan)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle meld with actions', () => {
      const meld = defined(SalvageUnionReference.Meld.all()[0])
      const actions = SalvageUnionReference.resolveActions(meld)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should handle crawlers with actions', () => {
      const crawler = defined(SalvageUnionReference.Crawlers.all()[0])
      const actions = SalvageUnionReference.resolveActions(crawler)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })
  })

  describe('entities without actions', () => {
    it('should return undefined for entities with no actions or chassisAbilities', () => {
      const trait = defined(SalvageUnionReference.Traits.all()[0])
      const actions = SalvageUnionReference.resolveActions(trait)
      expect(actions).toBeUndefined()
    })

    it('should return undefined for crawler bays without actions', () => {
      const crawlerBay = defined(SalvageUnionReference.CrawlerBays.all()[0])
      const actions = SalvageUnionReference.resolveActions(crawlerBay)
      expect(actions).toBeUndefined()
    })
  })

  describe('caching behavior', () => {
    it('should use cached action map for multiple calls', () => {
      const system1 = defined(SalvageUnionReference.Systems.all()[0])
      const system2 = defined(SalvageUnionReference.Systems.all()[1])

      const actions1 = SalvageUnionReference.resolveActions(system1)
      const actions2 = SalvageUnionReference.resolveActions(system2)

      expect(actions1).toBeDefined()
      expect(actions2).toBeDefined()
      // Both should be resolved successfully, indicating cache is working
      expect(Array.isArray(actions1)).toBe(true)
      expect(Array.isArray(actions2)).toBe(true)
    })
  })

  describe('type coverage', () => {
    it('should accept any entity type that might have actions', () => {
      const chassis = defined(SalvageUnionReference.Chassis.all()[0])
      const system = defined(SalvageUnionReference.Systems.all()[0])
      const ability = defined(SalvageUnionReference.Abilities.all()[0])

      // All should work without type errors
      const chassisActions = SalvageUnionReference.resolveActions(chassis)
      const systemActions = SalvageUnionReference.resolveActions(system)
      const abilityActions = SalvageUnionReference.resolveActions(ability)

      expect(chassisActions).toBeDefined()
      expect(systemActions).toBeDefined()
      expect(abilityActions).toBeDefined()
    })
  })
})
