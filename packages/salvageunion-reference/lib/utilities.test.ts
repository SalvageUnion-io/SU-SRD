/**
 * Tests for utility functions (type guards and property extractors)
 */

import { describe, it, expect } from 'vitest'
import {
  hasTechLevel,
  hasSalvageValue,
  hasSlotsRequired,
  hasActions,
  hasTraits,
  isClass,
  isSystemOrModule,
  isChassis,
  isSystem,
  getTechLevel,
  getTechLevelNumber,
  getSalvageValue,
  getSlotsRequired,
  getPageReference,
  extractActions,
  getChassisAbilities,
  getStructurePoints,
  getEnergyPoints,
  getHeatCapacity,
  getSystemSlots,
  getModuleSlots,
  getCargoCapacity,
  getHitPoints,
  getAssetUrl,
} from './utilities.js'

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

describe('Additional Type Guards', () => {
  describe('hasTechLevel', () => {
    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(hasTechLevel(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = getReference().Modules.all()[0]!
      expect(hasTechLevel(module)).toBe(true)
    })

    it('should return true for chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      expect(hasTechLevel(chassis)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(hasTechLevel(ability)).toBe(false)
    })
  })

  describe('hasSalvageValue', () => {
    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(hasSalvageValue(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = getReference().Modules.all()[0]!
      expect(hasSalvageValue(module)).toBe(true)
    })

    it('should return true for chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      expect(hasSalvageValue(chassis)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(hasSalvageValue(ability)).toBe(false)
    })
  })

  describe('hasSlotsRequired', () => {
    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(hasSlotsRequired(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = getReference().Modules.all()[0]!
      expect(hasSlotsRequired(module)).toBe(true)
    })

    it('should return false for chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      expect(hasSlotsRequired(chassis)).toBe(false)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(hasSlotsRequired(ability)).toBe(false)
    })
  })

  describe('hasActions', () => {
    it('should return false for chassis (chassis use chassisAbilities)', () => {
      const chassis = getReference().Chassis.all()[0]!
      expect(hasActions(chassis)).toBe(false)
    })

    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(hasActions(system)).toBe(true)
    })

    it('should return true for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(hasActions(ability)).toBe(true)
    })
  })

  describe('hasTraits', () => {
    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(hasTraits(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = getReference().Modules.all()[0]!
      expect(hasTraits(module)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(hasTraits(ability)).toBe(false)
    })
  })

  describe('isClass', () => {
    it('should return true for core classes', () => {
      const coreClass = getReference().Classes.find(
        (c) => 'coreTrees' in c && Array.isArray(c.coreTrees)
      )!
      expect(isClass(coreClass)).toBe(true)
    })

    it('should return true for advanced classes', () => {
      const advancedClass = getReference().Classes.find((c): boolean => {
        if (!('advancedTree' in c) || !c.advancedTree) return false
        const hasHybrid = 'hybrid' in c && (c as { hybrid?: boolean }).hybrid === true
        return !hasHybrid
      })!
      expect(isClass(advancedClass)).toBe(true)
    })

    it('should return true for hybrid classes', () => {
      // Hybrid classes have hybrid: true
      const hybridClass = getReference().Classes.find((c) => 'hybrid' in c && c.hybrid === true)
      expect(hybridClass).toBeDefined()
      expect(isClass(hybridClass!)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(isClass(ability)).toBe(false)
    })

    it('should return false for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(isClass(system)).toBe(false)
    })
  })

  describe('isSystemOrModule', () => {
    it('should return true for systems', () => {
      const system = getReference().Systems.all()[0]!
      expect(isSystemOrModule(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = getReference().Modules.all()[0]!
      expect(isSystemOrModule(module)).toBe(true)
    })

    it('should return false for chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      expect(isSystemOrModule(chassis)).toBe(false)
    })

    it('should return false for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      expect(isSystemOrModule(ability)).toBe(false)
    })
  })

  describe('Type narrowing with type guards', () => {
    it('should narrow type for chassis', () => {
      const chassis = getReference().Chassis.all()[0]!

      if (isChassis(chassis)) {
        // TypeScript should know this is a chassis
        expect(chassis.chassisAbilities).toBeDefined()
        expect(chassis.patterns).toBeDefined()
      }
    })

    it('should narrow type for systems', () => {
      const system = getReference().Systems.all()[0]!

      if (isSystem(system)) {
        // TypeScript should know this is a system
        expect(system.techLevel).toBeDefined()
        expect(system.slotsRequired).toBeDefined()
      }
    })

    it('should narrow type for classes', () => {
      const coreClass = getReference().Classes.find(
        (c) => 'coreTrees' in c && Array.isArray(c.coreTrees)
      )!

      if (isClass(coreClass)) {
        // TypeScript should know this is a class
        if ('coreTrees' in coreClass) {
          expect(coreClass.coreTrees).toBeDefined()
        }
      }
    })
  })
})

describe('Property Extractors', () => {
  describe('getTechLevel', () => {
    it('should extract techLevel from systems', () => {
      const system = getReference().Systems.all()[0]!
      const techLevel = getTechLevel(system)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the actual techLevel value
      expect(techLevel).toBe(system.techLevel)
    })

    it('should extract techLevel from modules', () => {
      const module = getReference().Modules.all()[0]!
      const techLevel = getTechLevel(module)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the actual techLevel value
      expect(techLevel).toBe(module.techLevel)
    })

    it('should extract techLevel from chassis stats', () => {
      const chassis = getReference().Chassis.all()[0]!
      const techLevel = getTechLevel(chassis)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the stats object
      expect(techLevel).toBe(chassis.techLevel)
    })

    it('should return undefined for entities without techLevel', () => {
      const ability = getReference().Abilities.all()[0]!
      const techLevel = getTechLevel(ability)
      expect(techLevel).toBeUndefined()
    })
  })

  describe('getTechLevelNumber', () => {
    it('should extract techLevel as number from systems', () => {
      const system = getReference().Systems.all()[0]!
      const techLevel = getTechLevelNumber(system)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof system.techLevel === 'number' ? system.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should extract techLevel as number from modules', () => {
      const module = getReference().Modules.all()[0]!
      const techLevel = getTechLevelNumber(module)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof module.techLevel === 'number' ? module.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should extract techLevel as number from chassis stats', () => {
      const chassis = getReference().Chassis.all()[0]!
      const techLevel = getTechLevelNumber(chassis)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof chassis.techLevel === 'number' ? chassis.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should return undefined for entities without techLevel', () => {
      const ability = getReference().Abilities.all()[0]!
      const techLevel = getTechLevelNumber(ability)
      expect(techLevel).toBeUndefined()
    })
  })

  describe('getSalvageValue', () => {
    it('should extract salvageValue from systems', () => {
      const system = getReference().Systems.all()[0]!
      const salvageValue = getSalvageValue(system)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
    })

    it('should extract salvageValue from modules', () => {
      const module = getReference().Modules.all()[0]!
      const salvageValue = getSalvageValue(module)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
    })

    it('should extract salvageValue from chassis stats', () => {
      const chassis = getReference().Chassis.all()[0]!
      const salvageValue = getSalvageValue(chassis)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
      // Verify it matches the stats object
      expect(salvageValue).toBe(chassis.salvageValue)
    })

    it('should return undefined for entities without salvageValue', () => {
      const ability = getReference().Abilities.all()[0]!
      const salvageValue = getSalvageValue(ability)
      expect(salvageValue).toBeUndefined()
    })
  })

  describe('getSlotsRequired', () => {
    it('should extract slotsRequired from systems', () => {
      const system = getReference().Systems.all()[0]!
      const slotsRequired = getSlotsRequired(system)
      expect(slotsRequired).toBeDefined()
      expect(typeof slotsRequired).toBe('number')
    })

    it('should extract slotsRequired from modules', () => {
      const module = getReference().Modules.all()[0]!
      const slotsRequired = getSlotsRequired(module)
      expect(slotsRequired).toBeDefined()
      expect(typeof slotsRequired).toBe('number')
    })

    it('should return undefined for entities without slotsRequired', () => {
      const chassis = getReference().Chassis.all()[0]!
      const slotsRequired = getSlotsRequired(chassis)
      expect(slotsRequired).toBeUndefined()
    })
  })

  describe('getPageReference', () => {
    it('should extract page from systems', () => {
      const system = getReference().Systems.all()[0]!
      const page = getPageReference(system)
      expect(page).toBeDefined()
      expect(typeof page).toBe('number')
    })

    it('should extract page from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const page = getPageReference(chassis)
      expect(page).toBeDefined()
      expect(typeof page).toBe('number')
    })
  })

  describe('extractActions', () => {
    it('should return undefined for chassis (chassis use chassisAbilities)', () => {
      const chassis = getReference().Chassis.all()[0]!
      const actions = extractActions(chassis)
      expect(actions).toBeUndefined()
    })

    it('should extract actions from systems', () => {
      const system = getReference().Systems.all()[0]!
      const actions = extractActions(system)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from modules', () => {
      const module = getReference().Modules.all()[0]!
      const actions = extractActions(module)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from NPCs', () => {
      const npc = getReference().NPCs.all()[0]!
      const actions = extractActions(npc)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from creatures', () => {
      const creature = getReference().Creatures.all()[0]!
      const actions = extractActions(creature)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from squads', () => {
      const squad = getReference().Squads.all()[0]!
      const actions = extractActions(squad)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from bio-titans', () => {
      const bioTitan = getReference().BioTitans.all()[0]!
      const actions = extractActions(bioTitan)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from meld', () => {
      const meld = getReference().Meld.all()[0]!
      const actions = extractActions(meld)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from crawlers', () => {
      const crawler = getReference().Crawlers.all()[0]!
      const actions = extractActions(crawler)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from crawler bays', () => {
      const crawlerBay = getReference().CrawlerBays.all()[0]!
      const actions = extractActions(crawlerBay)
      // Crawler bays no longer have actions property
      expect(actions).toBeUndefined()
    })

    it('should return undefined for entities without actions', () => {
      const trait = getReference().Traits.all()[0]!
      const actions = extractActions(trait)
      expect(actions).toBeUndefined()
    })

    it('should extract actions from abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      const actions = extractActions(ability)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })

    it('should extract actions from equipment', () => {
      const equipment = getReference().Equipment.all()[0]!
      const actions = extractActions(equipment)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(actions!.length).toBeGreaterThan(0)
    })
  })

  describe('getChassisAbilities', () => {
    it('should extract chassis abilities from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const chassisAbilities = getChassisAbilities(chassis)
      expect(chassisAbilities).toBeDefined()
      expect(Array.isArray(chassisAbilities)).toBe(true)
      expect(chassisAbilities!.length).toBeGreaterThan(0)
    })

    it('should return undefined for non-chassis entities', () => {
      const system = getReference().Systems.all()[0]!
      const chassisAbilities = getChassisAbilities(system)
      expect(chassisAbilities).toBeUndefined()
    })

    it('should return undefined for abilities', () => {
      const ability = getReference().Abilities.all()[0]!
      const chassisAbilities = getChassisAbilities(ability)
      expect(chassisAbilities).toBeUndefined()
    })
  })

  describe('getStructurePoints', () => {
    it('should extract structurePoints from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const structurePoints = getStructurePoints(chassis)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
      expect(structurePoints).toBe(chassis.structurePoints)
    })

    it('should extract structurePoints from drones', () => {
      const drone = getReference().Drones.all()[0]!
      const structurePoints = getStructurePoints(drone)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
    })

    it('should extract structurePoints from vehicles', () => {
      const vehicle = getReference().Vehicles.all()[0]!
      const structurePoints = getStructurePoints(vehicle)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
    })

    it('should return undefined for entities without structure points', () => {
      const system = getReference().Systems.all()[0]!
      const structurePoints = getStructurePoints(system)
      expect(structurePoints).toBeUndefined()
    })
  })

  describe('getEnergyPoints', () => {
    it('should extract energyPoints from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const energyPoints = getEnergyPoints(chassis)
      expect(energyPoints).toBeDefined()
      expect(typeof energyPoints).toBe('number')
      expect(energyPoints).toBe(chassis.energyPoints)
    })

    it('should return undefined for entities without energy points', () => {
      const system = getReference().Systems.all()[0]!
      const energyPoints = getEnergyPoints(system)
      expect(energyPoints).toBeUndefined()
    })
  })

  describe('getHeatCapacity', () => {
    it('should extract heatCapacity from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const heatCapacity = getHeatCapacity(chassis)
      expect(heatCapacity).toBeDefined()
      expect(typeof heatCapacity).toBe('number')
      expect(heatCapacity).toBe(chassis.heatCapacity)
    })

    it('should return undefined for entities without heat capacity', () => {
      const system = getReference().Systems.all()[0]!
      const heatCapacity = getHeatCapacity(system)
      expect(heatCapacity).toBeUndefined()
    })
  })

  describe('getSystemSlots', () => {
    it('should extract systemSlots from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const systemSlots = getSystemSlots(chassis)
      expect(systemSlots).toBeDefined()
      expect(typeof systemSlots).toBe('number')
      expect(systemSlots).toBe(chassis.systemSlots)
    })

    it('should return undefined for entities without system slots', () => {
      const system = getReference().Systems.all()[0]!
      const systemSlots = getSystemSlots(system)
      expect(systemSlots).toBeUndefined()
    })
  })

  describe('getModuleSlots', () => {
    it('should extract moduleSlots from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const moduleSlots = getModuleSlots(chassis)
      expect(moduleSlots).toBeDefined()
      expect(typeof moduleSlots).toBe('number')
      expect(moduleSlots).toBe(chassis.moduleSlots)
    })

    it('should return undefined for entities without module slots', () => {
      const system = getReference().Systems.all()[0]!
      const moduleSlots = getModuleSlots(system)
      expect(moduleSlots).toBeUndefined()
    })
  })

  describe('getCargoCapacity', () => {
    it('should extract cargoCapacity from chassis', () => {
      const chassis = getReference().Chassis.all()[0]!
      const cargoCapacity = getCargoCapacity(chassis)
      expect(cargoCapacity).toBeDefined()
      expect(typeof cargoCapacity).toBe('number')
      expect(cargoCapacity).toBe(chassis.cargoCapacity)
    })

    it('should return undefined for entities without cargo capacity', () => {
      const system = getReference().Systems.all()[0]!
      const cargoCapacity = getCargoCapacity(system)
      expect(cargoCapacity).toBeUndefined()
    })
  })

  describe('getHitPoints', () => {
    it('should extract hitPoints from NPCs', () => {
      const npc = getReference().NPCs.all()[0]!
      const hitPoints = getHitPoints(npc)
      expect(hitPoints).toBeDefined()
      expect(typeof hitPoints).toBe('number')
    })

    it('should extract hitPoints from creatures', () => {
      const creature = getReference().Creatures.all()[0]!
      const hitPoints = getHitPoints(creature)
      expect(hitPoints).toBeDefined()
      expect(typeof hitPoints).toBe('number')
    })

    it('should return undefined for entities without hit points', () => {
      const chassis = getReference().Chassis.all()[0]!
      const hitPoints = getHitPoints(chassis)
      expect(hitPoints).toBeUndefined()
    })
  })

  describe('getAssetUrl', () => {
    it('should extract asset_url from chassis', () => {
      const chassis = getReference().Chassis.find((c) => c.name === 'Mule')
      const assetUrl = getAssetUrl(chassis!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('chassis/mule.png')
    })

    it('should extract asset_url from bio-titans', () => {
      const bioTitan = getReference().BioTitans.find((b) => b.name === 'Typhon')
      const assetUrl = getAssetUrl(bioTitan!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('bio-titans/typhon.jpg')
    })

    it('should extract asset_url from creatures', () => {
      const creature = getReference().Creatures.find((c) => c.name === 'Artl')
      const assetUrl = getAssetUrl(creature!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('creatures/artl.jpg')
    })

    it('should extract asset_url from NPCs', () => {
      const npc = getReference().NPCs.find((n) => n.name === 'Wastelander')
      const assetUrl = getAssetUrl(npc!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('npcs/wastelander.jpg')
    })

    it('should extract asset_url from core classes', () => {
      const coreClass = getReference().Classes.find(
        (c) => c.name === 'Engineer' && 'coreTrees' in c && Array.isArray(c.coreTrees)
      )
      const assetUrl = getAssetUrl(coreClass!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('classes.core/engineer.jpg')
    })

    it('should extract asset_url from hybrid classes', () => {
      // Hybrid classes have hybrid: true
      const hybridClass = getReference().Classes.find(
        (c) => c.name === 'Cyborg' && 'hybrid' in c && c.hybrid === true
      )
      const assetUrl = getAssetUrl(hybridClass!)
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('classes.hybrid/cyborg.jpg')
    })

    it('should return undefined for entities without asset_url', () => {
      const ability = getReference().Abilities.all()[0]!
      const assetUrl = getAssetUrl(ability)
      expect(assetUrl).toBeUndefined()
    })
  })
})
