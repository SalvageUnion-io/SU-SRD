/**
 * Tests for utility functions (type guards and property extractors)
 */

import { describe, it, expect } from 'bun:test'
import {
  hasTechLevel,
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
  getUpkeepCost,
  getUpgradeCost,
  getAssetUrl,
  getPatterns,
  isHiddenPattern,
  normalizePatternName,
  resolveFormationMember,
  visiblePatterns,
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

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('Additional Type Guards', () => {
  describe('hasTechLevel', () => {
    it('should return true for systems', () => {
      const system = defined(getReference().Systems.all()[0])
      expect(hasTechLevel(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = defined(getReference().Modules.all()[0])
      expect(hasTechLevel(module)).toBe(true)
    })

    it('should return true for chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      expect(hasTechLevel(chassis)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      expect(hasTechLevel(ability)).toBe(false)
    })
  })

  describe('hasTraits', () => {
    it('should return true for systems', () => {
      const system = defined(getReference().Systems.all()[0])
      expect(hasTraits(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = defined(getReference().Modules.all()[0])
      expect(hasTraits(module)).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      expect(hasTraits(ability)).toBe(false)
    })
  })

  describe('isClass', () => {
    it('should return true for core classes', () => {
      const coreClass = defined(
        getReference().Classes.find((c) => 'coreTrees' in c && Array.isArray(c.coreTrees))
      )
      expect(isClass(coreClass)).toBe(true)
    })

    it('should return true for advanced classes', () => {
      const advancedClass = defined(
        getReference().Classes.find((c): boolean => {
          if (!('advancedTree' in c) || !c.advancedTree) return false
          const hasHybrid = 'hybrid' in c && c.hybrid === true
          return !hasHybrid
        })
      )
      expect(isClass(advancedClass)).toBe(true)
    })

    it('should return true for hybrid classes', () => {
      // Hybrid classes have hybrid: true
      const hybridClass = getReference().Classes.find((c) => 'hybrid' in c && c.hybrid === true)
      expect(hybridClass).toBeDefined()
      expect(isClass(defined(hybridClass))).toBe(true)
    })

    it('should return false for abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      expect(isClass(ability)).toBe(false)
    })

    it('should return false for systems', () => {
      const system = defined(getReference().Systems.all()[0])
      expect(isClass(system)).toBe(false)
    })
  })

  describe('isSystemOrModule', () => {
    it('should return true for systems', () => {
      const system = defined(getReference().Systems.all()[0])
      expect(isSystemOrModule(system)).toBe(true)
    })

    it('should return true for modules', () => {
      const module = defined(getReference().Modules.all()[0])
      expect(isSystemOrModule(module)).toBe(true)
    })

    it('should return false for chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      expect(isSystemOrModule(chassis)).toBe(false)
    })

    it('should return false for abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      expect(isSystemOrModule(ability)).toBe(false)
    })
  })

  describe('Type narrowing with type guards', () => {
    it('should narrow type for chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])

      if (isChassis(chassis)) {
        // TypeScript should know this is a chassis
        expect(chassis.chassisAbilities).toBeDefined()
        expect(chassis.patterns).toBeDefined()
      }
    })

    it('should narrow type for systems', () => {
      const system = defined(getReference().Systems.all()[0])

      if (isSystem(system)) {
        // TypeScript should know this is a system
        expect(system.techLevel).toBeDefined()
        expect(system.slotsRequired).toBeDefined()
      }
    })

    it('should narrow type for classes', () => {
      const coreClass = defined(
        getReference().Classes.find((c) => 'coreTrees' in c && Array.isArray(c.coreTrees))
      )

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
      const system = defined(getReference().Systems.all()[0])
      const techLevel = getTechLevel(system)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the actual techLevel value
      expect(techLevel).toBe(system.techLevel)
    })

    it('should extract techLevel from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const techLevel = getTechLevel(module)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the actual techLevel value
      expect(techLevel).toBe(module.techLevel)
    })

    it('should extract techLevel from chassis stats', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const techLevel = getTechLevel(chassis)
      expect(techLevel).toBeDefined()
      // Should return actual value (number, 'B', or 'N')
      expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
      // Verify it matches the stats object
      expect(techLevel).toBe(chassis.techLevel)
    })

    it('should return undefined for entities without techLevel', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const techLevel = getTechLevel(ability)
      expect(techLevel).toBeUndefined()
    })
  })

  describe('getTechLevelNumber', () => {
    it('should extract techLevel as number from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const techLevel = getTechLevelNumber(system)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof system.techLevel === 'number' ? system.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should extract techLevel as number from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const techLevel = getTechLevelNumber(module)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof module.techLevel === 'number' ? module.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should extract techLevel as number from chassis stats', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const techLevel = getTechLevelNumber(chassis)
      expect(techLevel).toBeDefined()
      expect(typeof techLevel).toBe('number')
      // Should normalize 'B' and 'N' to 1
      const expected = typeof chassis.techLevel === 'number' ? chassis.techLevel : 1
      expect(techLevel).toBe(expected)
    })

    it('should return undefined for entities without techLevel', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const techLevel = getTechLevelNumber(ability)
      expect(techLevel).toBeUndefined()
    })
  })

  describe('getSalvageValue', () => {
    it('should extract salvageValue from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const salvageValue = getSalvageValue(system)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
    })

    it('should extract salvageValue from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const salvageValue = getSalvageValue(module)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
    })

    it('should extract salvageValue from chassis stats', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const salvageValue = getSalvageValue(chassis)
      expect(salvageValue).toBeDefined()
      expect(typeof salvageValue).toBe('number')
      // Verify it matches the stats object
      expect(salvageValue).toBe(chassis.salvageValue)
    })

    it('should return undefined for entities without salvageValue', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const salvageValue = getSalvageValue(ability)
      expect(salvageValue).toBeUndefined()
    })
  })

  describe('getSlotsRequired', () => {
    it('should extract slotsRequired from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const slotsRequired = getSlotsRequired(system)
      expect(slotsRequired).toBeDefined()
      expect(typeof slotsRequired).toBe('number')
    })

    it('should extract slotsRequired from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const slotsRequired = getSlotsRequired(module)
      expect(slotsRequired).toBeDefined()
      expect(typeof slotsRequired).toBe('number')
    })

    it('should return undefined for entities without slotsRequired', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const slotsRequired = getSlotsRequired(chassis)
      expect(slotsRequired).toBeUndefined()
    })
  })

  describe('getPageReference', () => {
    it('should extract page from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const page = getPageReference(system)
      expect(page).toBeDefined()
      expect(typeof page).toBe('number')
    })

    it('should extract page from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const page = getPageReference(chassis)
      expect(page).toBeDefined()
      expect(typeof page).toBe('number')
    })

    const schemasWithPages = [
      'Abilities',
      'AbilityTreeRequirements',
      'BioTitans',
      'Chassis',
      'Classes',
      'CrawlerBays',
      'CrawlerTechLevels',
      'Crawlers',
      'Creatures',
      'Distances',
      'Drones',
      'Equipment',
      'Factions',
      'Keywords',
      'Meld',
      'Modules',
      'NPCs',
      'RollTables',
      'Squads',
      'Systems',
      'Traits',
      'Vehicles',
    ] as const

    for (const schemaName of schemasWithPages) {
      it(`every ${schemaName} entity should have a valid page number`, () => {
        const ref = getReference()
        const model = ref[schemaName]
        const entities = model.all()
        expect(entities.length).toBeGreaterThan(0)

        for (const entity of entities) {
          const page = getPageReference(entity)
          expect(page).toBeDefined()
          expect(typeof page).toBe('number')
          expect(page).toBeGreaterThan(0)
        }
      })
    }
  })

  describe('extractActions', () => {
    it('should return undefined for chassis (chassis use chassisAbilities)', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const actions = extractActions(chassis)
      expect(actions).toBeUndefined()
    })

    it('should extract actions from systems', () => {
      const system = defined(getReference().Systems.all()[0])
      const actions = extractActions(system)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from modules', () => {
      const module = defined(getReference().Modules.all()[0])
      const actions = extractActions(module)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from NPCs', () => {
      const npc = defined(getReference().NPCs.all()[0])
      const actions = extractActions(npc)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from creatures', () => {
      const creature = defined(getReference().Creatures.all()[0])
      const actions = extractActions(creature)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from squads', () => {
      const squad = defined(getReference().Squads.all()[0])
      const actions = extractActions(squad)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from bio-titans', () => {
      const titan = defined(getReference().BioTitans.all()[0])
      const actions = extractActions(titan)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from meld', () => {
      const meld = defined(getReference().Meld.all()[0])
      const actions = extractActions(meld)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from crawlers', () => {
      const crawler = defined(getReference().Crawlers.all()[0])
      const actions = extractActions(crawler)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
    })

    it('should extract actions from crawler bays', () => {
      const crawlerBay = defined(getReference().CrawlerBays.all()[0])
      const actions = extractActions(crawlerBay)
      // Crawler bays no longer have actions property
      expect(actions).toBeUndefined()
    })

    it('should return undefined for entities without actions', () => {
      const trait = defined(getReference().Traits.all()[0])
      const actions = extractActions(trait)
      expect(actions).toBeUndefined()
    })

    it('should extract actions from abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const actions = extractActions(ability)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })

    it('should extract actions from equipment', () => {
      const equipment = defined(getReference().Equipment.all()[0])
      const actions = extractActions(equipment)
      expect(actions).toBeDefined()
      expect(Array.isArray(actions)).toBe(true)
      expect(defined(actions).length).toBeGreaterThan(0)
    })
  })

  describe('getChassisAbilities', () => {
    it('should extract chassis abilities from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const chassisAbilities = getChassisAbilities(chassis)
      expect(chassisAbilities).toBeDefined()
      expect(Array.isArray(chassisAbilities)).toBe(true)
      expect(defined(chassisAbilities).length).toBeGreaterThan(0)
    })

    it('should return undefined for non-chassis entities', () => {
      const system = defined(getReference().Systems.all()[0])
      const chassisAbilities = getChassisAbilities(system)
      expect(chassisAbilities).toBeUndefined()
    })

    it('should return undefined for abilities', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const chassisAbilities = getChassisAbilities(ability)
      expect(chassisAbilities).toBeUndefined()
    })
  })

  describe('getStructurePoints', () => {
    it('should extract structurePoints from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const structurePoints = getStructurePoints(chassis)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
      expect(structurePoints).toBe(chassis.structurePoints)
    })

    it('should extract structurePoints from drones', () => {
      const drone = defined(getReference().Drones.all()[0])
      const structurePoints = getStructurePoints(drone)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
    })

    it('should extract structurePoints from vehicles', () => {
      const vehicle = defined(getReference().Vehicles.all()[0])
      const structurePoints = getStructurePoints(vehicle)
      expect(structurePoints).toBeDefined()
      expect(typeof structurePoints).toBe('number')
    })

    it('should return undefined for entities without structure points', () => {
      const system = defined(getReference().Systems.all()[0])
      const structurePoints = getStructurePoints(system)
      expect(structurePoints).toBeUndefined()
    })
  })

  describe('getEnergyPoints', () => {
    it('should extract energyPoints from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const energyPoints = getEnergyPoints(chassis)
      expect(energyPoints).toBeDefined()
      expect(typeof energyPoints).toBe('number')
      expect(energyPoints).toBe(chassis.energyPoints)
    })

    it('should return undefined for entities without energy points', () => {
      const system = defined(getReference().Systems.all()[0])
      const energyPoints = getEnergyPoints(system)
      expect(energyPoints).toBeUndefined()
    })
  })

  describe('getHeatCapacity', () => {
    it('should extract heatCapacity from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const heatCapacity = getHeatCapacity(chassis)
      expect(heatCapacity).toBeDefined()
      expect(typeof heatCapacity).toBe('number')
      expect(heatCapacity).toBe(chassis.heatCapacity)
    })

    it('should return undefined for entities without heat capacity', () => {
      const system = defined(getReference().Systems.all()[0])
      const heatCapacity = getHeatCapacity(system)
      expect(heatCapacity).toBeUndefined()
    })
  })

  describe('getSystemSlots', () => {
    it('should extract systemSlots from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const systemSlots = getSystemSlots(chassis)
      expect(systemSlots).toBeDefined()
      expect(typeof systemSlots).toBe('number')
      expect(systemSlots).toBe(chassis.systemSlots)
    })

    it('should return undefined for entities without system slots', () => {
      const system = defined(getReference().Systems.all()[0])
      const systemSlots = getSystemSlots(system)
      expect(systemSlots).toBeUndefined()
    })
  })

  describe('getModuleSlots', () => {
    it('should extract moduleSlots from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const moduleSlots = getModuleSlots(chassis)
      expect(moduleSlots).toBeDefined()
      expect(typeof moduleSlots).toBe('number')
      expect(moduleSlots).toBe(chassis.moduleSlots)
    })

    it('should return undefined for entities without module slots', () => {
      const system = defined(getReference().Systems.all()[0])
      const moduleSlots = getModuleSlots(system)
      expect(moduleSlots).toBeUndefined()
    })
  })

  describe('getCargoCapacity', () => {
    it('should extract cargoCapacity from chassis', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const cargoCapacity = getCargoCapacity(chassis)
      expect(cargoCapacity).toBeDefined()
      expect(typeof cargoCapacity).toBe('number')
      expect(cargoCapacity).toBe(chassis.cargoCapacity)
    })

    it('should return undefined for entities without cargo capacity', () => {
      const system = defined(getReference().Systems.all()[0])
      const cargoCapacity = getCargoCapacity(system)
      expect(cargoCapacity).toBeUndefined()
    })
  })

  describe('getHitPoints', () => {
    it('should extract hitPoints from NPCs', () => {
      const npc = defined(getReference().NPCs.all()[0])
      const hitPoints = getHitPoints(npc)
      expect(hitPoints).toBeDefined()
      expect(typeof hitPoints).toBe('number')
    })

    it('should extract hitPoints from creatures', () => {
      const creature = defined(getReference().Creatures.all()[0])
      const hitPoints = getHitPoints(creature)
      expect(hitPoints).toBeDefined()
      expect(typeof hitPoints).toBe('number')
    })

    it('should return undefined for entities without hit points', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      const hitPoints = getHitPoints(chassis)
      expect(hitPoints).toBeUndefined()
    })
  })

  describe('getUpkeepCost / getUpgradeCost', () => {
    const tier = (techLevel: number) =>
      defined(getReference().CrawlerTechLevels.find((t) => t.techLevel === techLevel))

    it('should extract both costs from a crawler tech level', () => {
      const hamlet = tier(1)
      expect(getUpkeepCost(hamlet)).toBe(hamlet.upkeepCost)
      expect(getUpgradeCost(hamlet)).toBe(hamlet.upgradeCost as number)
    })

    it('should return undefined for the null upgrade cost at the maximum tier', () => {
      // TL6 (Megacity) is the top of the table — `upgradeCost` is null in the
      // data because there is no next tier, and the stat must simply not render.
      const megacity = tier(6)
      expect(megacity.upgradeCost).toBeNull()
      expect(getUpgradeCost(megacity)).toBeUndefined()
      // Upkeep is still owed at the top tier.
      expect(getUpkeepCost(megacity)).toBe(megacity.upkeepCost)
    })

    it('should return undefined for entities that carry neither cost', () => {
      const chassis = defined(getReference().Chassis.all()[0])
      expect(getUpkeepCost(chassis)).toBeUndefined()
      expect(getUpgradeCost(chassis)).toBeUndefined()
    })
  })

  describe('getAssetUrl', () => {
    it('should extract asset_url from chassis', () => {
      const chassis = getReference().Chassis.find((c) => c.name === 'Mule')
      const assetUrl = getAssetUrl(defined(chassis))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('chassis/mule.webp')
    })

    it('should extract asset_url from bio-titans', () => {
      const titan = getReference().BioTitans.find((t) => t.name === 'Typhon')
      const assetUrl = getAssetUrl(defined(titan))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('bio-titans/typhon.webp')
    })

    it('should extract asset_url from creatures', () => {
      const creature = getReference().Creatures.find((c) => c.name === 'Artl')
      const assetUrl = getAssetUrl(defined(creature))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('creatures/artl.webp')
    })

    it('should extract asset_url from NPCs', () => {
      const npc = getReference().NPCs.find((n) => n.name === 'Wastelander')
      const assetUrl = getAssetUrl(defined(npc))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('npcs/wastelander.webp')
    })

    it('should extract asset_url from core classes', () => {
      const coreClass = getReference().Classes.find(
        (c) => c.name === 'Engineer' && 'coreTrees' in c && Array.isArray(c.coreTrees)
      )
      const assetUrl = getAssetUrl(defined(coreClass))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('classes/engineer.webp')
    })

    it('should extract asset_url from hybrid classes', () => {
      // Hybrid classes have hybrid: true
      const hybridClass = getReference().Classes.find(
        (c) => c.name === 'Cyborg' && 'hybrid' in c && c.hybrid === true
      )
      const assetUrl = getAssetUrl(defined(hybridClass))
      expect(assetUrl).toBeDefined()
      expect(typeof assetUrl).toBe('string')
      expect(assetUrl).toContain('classes/cyborg.webp')
    })

    it('should return undefined for entities without asset_url', () => {
      const ability = defined(getReference().Abilities.all()[0])
      const assetUrl = getAssetUrl(ability)
      expect(assetUrl).toBeUndefined()
    })
  })
})

/**
 * normalizePatternName was rewritten to drop a `\s+Pattern$` regex whose `\s+`
 * backtracked quadratically on a long whitespace run (CodeQL js/redos). The
 * rewrite is meant to be EXACTLY behaviour-preserving, so these tests pin both
 * the sharp edges of the old semantics and the performance property that is
 * the only real evidence the ReDoS is gone.
 */
describe('normalizePatternName', () => {
  /** Every pattern name carried by real chassis data. */
  function realPatternNames(): string[] {
    const names: string[] = []
    for (const chassis of getReference().Chassis.all()) {
      for (const pattern of getPatterns(chassis) ?? []) {
        names.push(pattern.name)
      }
    }
    return names
  }

  it('leaves every real pattern name in the dataset untouched', () => {
    const names = realPatternNames()
    // Guard against the corpus silently emptying out and the test passing vacuously.
    expect(names.length).toBeGreaterThan(100)
    for (const name of names) {
      expect(normalizePatternName(name)).toBe(name)
    }
  })

  it('still matches real formation members through the normalized comparison', () => {
    // resolveFormationMember is the production caller: it compares a faction's
    // declared pattern against chassis pattern names via normalizePatternName.
    let checked = 0
    for (const faction of getReference().Factions.all()) {
      const formation = faction.formation
      if (!Array.isArray(formation)) continue
      for (const member of formation) {
        if (!member || typeof member !== 'object' || typeof member.pattern !== 'string') continue
        const resolved = resolveFormationMember(member)
        if (!resolved?.pattern) continue
        checked++
        expect(normalizePatternName(resolved.pattern.name)).toBe(
          normalizePatternName(member.pattern)
        )
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('strips a single-space " Pattern" suffix', () => {
    expect(normalizePatternName('Iron Mongrel Pattern')).toBe('Iron Mongrel')
  })

  it('strips a multi-space separator, consuming all of it', () => {
    expect(normalizePatternName('Iron  Pattern')).toBe('Iron')
  })

  it('leaves a bare "Pattern" unchanged (the separator is required)', () => {
    // The old regex was `\s+Pattern$` — at least one whitespace char is
    // mandatory, so a name that IS the literal must survive intact.
    expect(normalizePatternName('Pattern')).toBe('Pattern')
  })

  it('leaves "IronPattern" unchanged (no separator before the literal)', () => {
    expect(normalizePatternName('IronPattern')).toBe('IronPattern')
  })

  it('leaves trailing whitespace after the suffix unchanged', () => {
    // The old regex was `$`-anchored with NO trailing-whitespace tolerance, so
    // "Iron Pattern  " does not match at all. A rewrite that trimEnd()s first
    // would wrongly return "Iron"; this locks the original behaviour.
    expect(normalizePatternName('Iron Pattern  ')).toBe('Iron Pattern  ')
    expect(normalizePatternName('Iron Pattern\n')).toBe('Iron Pattern\n')
  })

  it('matches the suffix case-insensitively', () => {
    expect(normalizePatternName('Iron pattern')).toBe('Iron')
    expect(normalizePatternName('Iron PATTERN')).toBe('Iron')
    expect(normalizePatternName('Iron PaTtErN')).toBe('Iron')
  })

  it('treats any whitespace run as the separator', () => {
    expect(normalizePatternName('Iron\tPattern')).toBe('Iron')
    expect(normalizePatternName('Iron \t\n Pattern')).toBe('Iron')
  })

  it('reduces a name that is nothing but separator + suffix to the empty string', () => {
    expect(normalizePatternName(' Pattern')).toBe('')
  })

  it('completes on a pathological whitespace run (ReDoS regression)', () => {
    // 200k spaces followed by nothing that can complete the suffix: the old
    // `\s+Pattern$` retried `\s+` from every one of those positions, which is
    // quadratic. The rewrite is a single linear scan.
    const pathological = `${' '.repeat(200_000)}!`
    const start = performance.now()
    expect(normalizePatternName(pathological)).toBe(pathological)
    expect(performance.now() - start).toBeLessThan(1000)
  })

  it('completes on a pathological whitespace run that DOES end in the suffix', () => {
    const pathological = `Iron${' '.repeat(200_000)}Pattern`
    const start = performance.now()
    expect(normalizePatternName(pathological)).toBe('Iron')
    expect(performance.now() - start).toBeLessThan(1000)
  })
})

describe('visiblePatterns (stored data tag — never computed)', () => {
  it('filters by the stored hidden flag only', () => {
    const shown = { name: 'A', hidden: undefined }
    const tagged = { name: 'B', hidden: true }
    const explicitFalse = { name: 'C', hidden: false }
    expect(visiblePatterns([shown, tagged, explicitFalse])).toEqual([shown, explicitFalse])
    expect(isHiddenPattern(tagged.hidden)).toBe(true)
    expect(isHiddenPattern(shown.hidden)).toBe(false)
    expect(isHiddenPattern(explicitFalse.hidden)).toBe(false)
  })

  it('withholds the tagged patterns from the real catalog', () => {
    const chassis = getReference().Chassis.all()
    const all = chassis.flatMap((c) => c.patterns)
    const hidden = all.filter((p) => p.hidden)
    // The tag is a strict subset — the catalog keeps the records, hides some.
    expect(hidden.length).toBeGreaterThan(0)
    expect(visiblePatterns(all)).toHaveLength(all.length - hidden.length)
    expect(visiblePatterns(all).some((p) => p.hidden)).toBe(false)
  })

  it('getPatterns never returns a hidden pattern', () => {
    for (const chassis of getReference().Chassis.all()) {
      expect((getPatterns(chassis) ?? []).some((p) => p.hidden)).toBe(false)
    }
  })

  it('every visible pattern carries its own source and page', () => {
    for (const chassis of getReference().Chassis.all()) {
      for (const pattern of visiblePatterns(chassis.patterns ?? [])) {
        expect(pattern.source).toBeTruthy()
        expect(typeof pattern.page).toBe('number')
      }
    }
  })
})
