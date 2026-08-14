import { describe, expect, it } from 'bun:test'
import { BaseModel } from './BaseModel.js'
import { EntitySchemaNames, SalvageUnionReference, SchemaToModelMap } from './index.js'
import {
  getPageReference,
  getSalvageValue,
  getSlotsRequired,
  getTechLevel,
  getTechLevelNumber,
  isAbility,
} from './utilities.js'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('SalvageUnionReference static properties', () => {
  it('should have all model properties defined and returning data', () => {
    // Get all static properties from the class
    const staticProps = Object.getOwnPropertyNames(SalvageUnionReference).filter((prop) => {
      // Filter out constructor and methods
      const methodNames = [
        'length',
        'prototype',
        'name',
        'findIn',
        'findAllIn',
        'search',
        'searchIn',
        'getSuggestions',
        'get',
        'getByNameIn',
        'exists',
        'getMany',
        'parseRef',
        'getByRef',
        'getSlotsRequired',
        'getAllClasses',
        'findClassById',
        'getAbilitiesForClass',
        'resolveActions',
        'entityCache',
        'getAllBySchemaNames',
        'preload',
        'isLoaded',
      ]
      return !methodNames.includes(prop)
    })

    // Ensure we found some properties
    expect(staticProps.length).toBeGreaterThan(0)

    // Test each static property
    for (const propName of staticProps) {
      const prop = SalvageUnionReference[propName as keyof typeof SalvageUnionReference]

      // Check that the property is defined
      expect(prop).toBeDefined()
      expect(prop).not.toBeUndefined()
      expect(prop).not.toBeNull()

      // Check that it's a BaseModel instance (the instanceof assertion above
      // throws on failure, so this guard is dead at runtime — it exists to
      // narrow the type without an assertion)
      expect(prop).toBeInstanceOf(BaseModel)
      if (!(prop instanceof BaseModel)) continue

      // Check that it has the expected methods
      expect(typeof prop.all).toBe('function')
      expect(typeof prop.find).toBe('function')
      expect(typeof prop.findAll).toBe('function')

      // Check that .all() returns an array
      const allData = prop.all()
      expect(Array.isArray(allData)).toBe(true)

      // Log for debugging
      console.log(`✓ ${propName}: ${allData.length} items`)
    }
  })

  it('should have specific expected models', () => {
    // Test a few key models explicitly (checked annotation: every name must
    // be a real static of SalvageUnionReference)
    const expectedModels: (keyof typeof SalvageUnionReference)[] = [
      'Abilities',
      'Chassis',
      'Systems',
      'Modules',
      'Equipment',
      'NPCs',
      'Creatures',
      'Vehicles',
    ]

    for (const modelName of expectedModels) {
      const model = SalvageUnionReference[modelName]
      expect(model).toBeDefined()
      expect(model).toBeInstanceOf(BaseModel)
      // The instanceof assertion above throws on failure — this guard only narrows
      if (!(model instanceof BaseModel)) continue
      expect(model.all().length).toBeGreaterThan(0)
    }
  })
})

describe('SalvageUnionReference.Guides', () => {
  it('should have the Guides model defined', () => {
    expect(SalvageUnionReference.Guides).toBeDefined()
    expect(SalvageUnionReference.Guides).toBeInstanceOf(BaseModel)
  })

  it('should return all guides', () => {
    const guides = SalvageUnionReference.Guides.all()
    expect(Array.isArray(guides)).toBe(true)
    expect(guides.length).toBeGreaterThan(0)
  })

  it('should find a guide by name', () => {
    const guide = SalvageUnionReference.Guides.find((g) => g.name === 'Create a Pilot')
    expect(guide).toBeDefined()
    expect(guide?.name).toBe('Create a Pilot')
    expect(guide?.guideType).toBe('character-creation')
  })

  it('should have valid guideType on all guides', () => {
    const validTypes = [
      'character-creation',
      'mech-creation',
      'crawler-creation',
      'progression',
      'downtime',
      'gameplay',
    ]
    const guides = SalvageUnionReference.Guides.all()
    for (const guide of guides) {
      expect(validTypes).toContain(guide.guideType)
    }
  })

  it('should have a known guideTone on all guides', () => {
    // A NAME, not a colour: the hex this used to assert made the dataset a
    // second palette. `theme.css` owns every value; component-lib maps the
    // name to a token (see `entityGuideToneColor`).
    const tones = new Set(['pilot', 'mech', 'crawler', 'salvage', 'hazard', 'ink'])
    const guides = SalvageUnionReference.Guides.all()
    for (const guide of guides) {
      expect(tones.has(guide.guideTone)).toBe(true)
    }
  })

  it('should have non-empty steps array on all guides', () => {
    const guides = SalvageUnionReference.Guides.all()
    for (const guide of guides) {
      expect(Array.isArray(guide.steps)).toBe(true)
      expect(guide.steps.length).toBeGreaterThan(0)
    }
  })

  it('should have unique step IDs within each guide', () => {
    const guides = SalvageUnionReference.Guides.all()
    for (const guide of guides) {
      const stepIds = guide.steps.map((s) => s.id)
      const uniqueIds = new Set(stepIds)
      expect(uniqueIds.size).toBe(stepIds.length)
    }
  })

  it('should be accessible via findIn and findAllIn', () => {
    const guide = SalvageUnionReference.findIn(
      'guides',
      (g) => g.guideType === 'character-creation'
    )
    expect(guide).toBeDefined()
    expect(guide?.guideType).toBe('character-creation')

    const allGuides = SalvageUnionReference.findAllIn('guides', () => true)
    expect(allGuides.length).toBe(SalvageUnionReference.Guides.all().length)
  })

  it('should be accessible via get by ID', () => {
    const guides = SalvageUnionReference.Guides.all()
    const firstGuide = defined(guides[0])
    const fetched = SalvageUnionReference.get('guides', firstGuide.id)
    expect(fetched).toBeDefined()
    expect(fetched?.id).toBe(firstGuide.id)
    expect(fetched?.name).toBe(firstGuide.name)
  })

  it('should include guides in EntitySchemaNames', () => {
    expect(EntitySchemaNames.has('guides')).toBe(true)
  })

  it('should support paperOnly on guide steps', () => {
    const guide = defined(SalvageUnionReference.Guides.find((g) => g.name === 'Create a Pilot'))
    expect(guide).toBeDefined()
    const paperOnlySteps = guide.steps.filter((s) => s.paperOnly)
    expect(paperOnlySteps.length).toBeGreaterThan(0)
    expect(defined(paperOnlySteps[0]).paperOnly).toBe(true)
  })

  it('should default paperOnly to undefined when not set', () => {
    const guide = defined(SalvageUnionReference.Guides.find((g) => g.name === 'Create a Pilot'))
    const nonPaperStep = guide.steps.find((s) => !s.paperOnly)
    expect(nonPaperStep).toBeDefined()
    expect(defined(nonPaperStep).paperOnly).toBeUndefined()
  })
})

describe('SalvageUnionReference.findIn', () => {
  it('should find a single ability by name', () => {
    const ability = SalvageUnionReference.findIn(
      'abilities',
      (a) => a.name === 'Engineering Expertise'
    )
    expect(ability).toBeDefined()
    expect(ability?.name).toBe('Engineering Expertise')
  })

  it('should find a single system by tech level', () => {
    const system = SalvageUnionReference.findIn('systems', (s) => s.techLevel === 1)
    expect(system).toBeDefined()
    expect(system?.techLevel).toBe(1)
  })

  it('should return undefined when no match is found', () => {
    const ability = SalvageUnionReference.findIn(
      'abilities',
      (a) => a.name === 'NonExistentAbility'
    )
    expect(ability).toBeUndefined()
  })

  it('should work with different schema types', () => {
    const crawler = SalvageUnionReference.findIn('crawlers', (c) => c.name === 'Augmented')
    expect(crawler).toBeDefined()
    expect(crawler?.name).toBe('Augmented')
  })
})

describe('SalvageUnionReference.findAllIn', () => {
  it('should find all abilities at a specific level', () => {
    const abilities = SalvageUnionReference.findAllIn('abilities', (a) => a.level === 1)
    expect(abilities.length).toBeGreaterThan(0)
    expect(abilities.every((a) => a.level === 1)).toBe(true)
  })

  it('should find all systems with a specific trait', async () => {
    const { extractActions } = await import('./utilities.js')
    const energySystems = SalvageUnionReference.findAllIn('systems', (s) => {
      const resolvedActions = extractActions(s)
      return (
        resolvedActions?.[0]?.traits?.some((t: { type: string }) => t.type === 'energy') ?? false
      )
    })
    expect(energySystems.length).toBeGreaterThan(0)
    expect(
      energySystems.every((s) => {
        const resolvedActions = extractActions(s)
        return (
          resolvedActions?.[0]?.traits?.some((t: { type: string }) => t.type === 'energy') ?? false
        )
      })
    ).toBe(true)
  })

  it('should return empty array when no matches are found', () => {
    const abilities = SalvageUnionReference.findAllIn('abilities', (a) => a.level === 999)
    expect(abilities).toEqual([])
  })

  it('should work with different schema types', () => {
    const tech1Modules = SalvageUnionReference.findAllIn('modules', (m) => m.techLevel === 1)
    expect(tech1Modules.length).toBeGreaterThan(0)
    expect(tech1Modules.every((m) => m.techLevel === 1)).toBe(true)
  })

  it('should find all core classes', () => {
    const coreClasses = SalvageUnionReference.findAllIn(
      'classes',
      (c) => 'coreTrees' in c && Array.isArray(c.coreTrees)
    )
    expect(coreClasses.length).toBeGreaterThan(0)
  })
})

describe('SalvageUnionReference.get', () => {
  it('should get an entity by schema name and ID', () => {
    // First, find an ability to get its ID
    const allAbilities = SalvageUnionReference.Abilities.all()
    const firstAbility = defined(allAbilities[0])

    // Now use get() to retrieve it
    const ability = SalvageUnionReference.get('abilities', firstAbility.id)
    expect(ability).toBeDefined()
    expect(ability?.id).toBe(firstAbility.id)
    expect(ability?.name).toBe(firstAbility.name)
  })

  it('should return undefined for non-existent ID', () => {
    const ability = SalvageUnionReference.get('abilities', 'non-existent-id')
    expect(ability).toBeUndefined()
  })

  it('should work with different schema types', () => {
    const allSystems = SalvageUnionReference.Systems.all()
    const firstSystem = defined(allSystems[0])

    const system = SalvageUnionReference.get('systems', firstSystem.id)
    expect(system).toBeDefined()
    expect(system?.id).toBe(firstSystem.id)
  })

  it('should use caching for repeated lookups', () => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const firstAbility = defined(allAbilities[0])

    // First lookup
    const ability1 = SalvageUnionReference.get('abilities', firstAbility.id)
    // Second lookup (should use cache)
    const ability2 = SalvageUnionReference.get('abilities', firstAbility.id)

    expect(ability1).toBe(ability2) // Same reference
  })
})

describe('SalvageUnionReference.exists', () => {
  it('should return true for existing entity', () => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const firstAbility = defined(allAbilities[0])

    const exists = SalvageUnionReference.exists('abilities', firstAbility.id)
    expect(exists).toBe(true)
  })

  it('should return false for non-existent entity', () => {
    const exists = SalvageUnionReference.exists('abilities', 'non-existent-id')
    expect(exists).toBe(false)
  })
})

describe('SalvageUnionReference.getMany', () => {
  it('should get multiple entities', () => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const allSystems = SalvageUnionReference.Systems.all()

    const entities = SalvageUnionReference.getMany([
      { schemaName: 'abilities', id: defined(allAbilities[0]).id },
      { schemaName: 'systems', id: defined(allSystems[0]).id },
    ])

    expect(entities.length).toBe(2)
    expect(entities[0]).toBeDefined()
    expect(entities[1]).toBeDefined()
    expect(entities[0]?.id).toBe(defined(allAbilities[0]).id)
    expect(entities[1]?.id).toBe(defined(allSystems[0]).id)
  })

  it('should return undefined for non-existent entities', () => {
    const entities = SalvageUnionReference.getMany([
      { schemaName: 'abilities', id: 'non-existent-1' },
      { schemaName: 'systems', id: 'non-existent-2' },
    ])

    expect(entities.length).toBe(2)
    expect(entities[0]).toBeUndefined()
    expect(entities[1]).toBeUndefined()
  })
})

describe('SalvageUnionReference.parseRef', () => {
  it('should parse a valid reference string', () => {
    const parsed = SalvageUnionReference.parseRef('abilities::test-id')
    expect(parsed).toBeDefined()
    expect(parsed?.schemaName).toBe('abilities')
    expect(parsed?.id).toBe('test-id')
  })

  it('should return null for invalid reference string', () => {
    const parsed = SalvageUnionReference.parseRef('invalid-ref')
    expect(parsed).toBeNull()
  })

  it('should return null for invalid schema name', () => {
    const parsed = SalvageUnionReference.parseRef('invalid-schema::test-id')
    expect(parsed).toBeNull()
  })
})

describe('SalvageUnionReference.getByRef', () => {
  it('should get an entity by reference string', () => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const firstAbility = defined(allAbilities[0])

    const ref = `abilities::${firstAbility.id}`
    const entity = SalvageUnionReference.getByRef(ref)

    expect(entity).toBeDefined()
    expect(entity?.id).toBe(firstAbility.id)
  })

  it('should return undefined for invalid reference', () => {
    const entity = SalvageUnionReference.getByRef('invalid-ref')
    expect(entity).toBeUndefined()
  })
})

describe('Type Guards', () => {
  it('should correctly identify abilities', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    expect(isAbility(ability)).toBe(true)
  })

  it('should return false for non-abilities', () => {
    expect(isAbility(defined(SalvageUnionReference.Systems.all()[0]))).toBe(false)
    expect(isAbility(defined(SalvageUnionReference.Modules.all()[0]))).toBe(false)
    expect(isAbility(defined(SalvageUnionReference.Chassis.all()[0]))).toBe(false)
  })

  it('should return false for null or undefined', () => {
    expect(isAbility(null)).toBe(false)
    expect(isAbility(undefined)).toBe(false)
  })
})

describe('Property Extractors', () => {
  it('should extract techLevel from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const techLevel = getTechLevel(system)
    expect(techLevel).toBeDefined()
    // Should return actual value (number, 'B', or 'N')
    expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
    // Verify it matches the actual techLevel value
    expect(techLevel).toBe(system.techLevel)
  })

  it('should extract techLevel from modules', () => {
    const module = defined(SalvageUnionReference.Modules.all()[0])
    const techLevel = getTechLevel(module)
    expect(techLevel).toBeDefined()
    // Should return actual value (number, 'B', or 'N')
    expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
    // Verify it matches the actual techLevel value
    expect(techLevel).toBe(module.techLevel)
  })

  it('should return undefined for entities without techLevel', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const techLevel = getTechLevel(ability)
    expect(techLevel).toBeUndefined()
  })

  it('should extract salvageValue from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const salvageValue = getSalvageValue(system)
    expect(salvageValue).toBeDefined()
    expect(typeof salvageValue).toBe('number')
  })

  it('should extract page reference from all entities', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const system = defined(SalvageUnionReference.Systems.all()[0])

    const abilityPage = getPageReference(ability)
    const systemPage = getPageReference(system)

    expect(abilityPage).toBeDefined()
    expect(systemPage).toBeDefined()
    expect(typeof abilityPage).toBe('number')
    expect(typeof systemPage).toBe('number')
  })
})

describe('getTechLevel', () => {
  it('should get tech level from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const techLevel = getTechLevel(system)

    expect(techLevel).toBeDefined()
    // Should return actual value (number, 'B', or 'N')
    expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
    // Verify it matches the actual techLevel value
    expect(techLevel).toBe(system.techLevel)
  })

  it('should get tech level from chassis (in stats)', () => {
    const chassis = defined(SalvageUnionReference.Chassis.all()[0])
    const techLevel = getTechLevel(chassis)

    expect(techLevel).toBeDefined()
    // Should return actual value (number, 'B', or 'N')
    expect(typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N').toBe(true)
    // Verify it matches the actual techLevel value
    expect(techLevel).toBe(chassis.techLevel)
  })

  it('should return undefined for entities without tech level', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const techLevel = getTechLevel(ability)

    expect(techLevel).toBeUndefined()
  })
})

describe('getTechLevelNumber', () => {
  it('should get tech level as number from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const techLevel = getTechLevelNumber(system)

    expect(techLevel).toBeDefined()
    expect(typeof techLevel).toBe('number')
    // Should normalize 'B' and 'N' to 1
    const expected = typeof system.techLevel === 'number' ? system.techLevel : 1
    expect(techLevel).toBe(expected)
  })

  it('should get tech level as number from chassis (in stats)', () => {
    const chassis = defined(SalvageUnionReference.Chassis.all()[0])
    const techLevel = getTechLevelNumber(chassis)

    expect(techLevel).toBeDefined()
    expect(typeof techLevel).toBe('number')
    // Should normalize 'B' and 'N' to 1
    const expected = typeof chassis.techLevel === 'number' ? chassis.techLevel : 1
    expect(techLevel).toBe(expected)
  })

  it('should return undefined for entities without tech level', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const techLevel = getTechLevelNumber(ability)

    expect(techLevel).toBeUndefined()
  })
})

describe('getSalvageValue', () => {
  it('should get salvage value from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const salvageValue = getSalvageValue(system)

    expect(salvageValue).toBeDefined()
    expect(typeof salvageValue).toBe('number')
    expect(salvageValue).toBe(system.salvageValue)
  })

  it('should get salvage value from chassis (in stats)', () => {
    const chassis = defined(SalvageUnionReference.Chassis.all()[0])
    const salvageValue = getSalvageValue(chassis)

    expect(salvageValue).toBeDefined()
    expect(typeof salvageValue).toBe('number')
    expect(salvageValue).toBe(chassis.salvageValue)
  })

  it('should return undefined for entities without salvage value', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const salvageValue = getSalvageValue(ability)

    expect(salvageValue).toBeUndefined()
  })
})

describe('SalvageUnionReference.CatalogCategories', () => {
  it('should have the CatalogCategories model defined', () => {
    expect(SalvageUnionReference.CatalogCategories).toBeDefined()
    expect(SalvageUnionReference.CatalogCategories).toBeInstanceOf(BaseModel)
  })

  it('should return all catalog categories', () => {
    const categories = SalvageUnionReference.CatalogCategories.all()
    expect(Array.isArray(categories)).toBe(true)
    expect(categories.length).toBe(6)
  })

  it('should have correct category IDs in order', () => {
    const categories = SalvageUnionReference.CatalogCategories.all()
    const ids = categories.map((c) => c.id)
    expect(ids).toEqual(['pilot', 'mech', 'crawler', 'denizens', 'reference', 'guides'])
  })

  it('should have valid SchemaName references in all categories', () => {
    const validSchemaNames = new Set(Object.keys(SchemaToModelMap))
    const categories = SalvageUnionReference.CatalogCategories.all()
    for (const cat of categories) {
      for (const schemaName of cat.schemas) {
        expect(validSchemaNames.has(schemaName)).toBe(true)
      }
    }
  })

  it('should only have flat=true on guides category', () => {
    const categories = SalvageUnionReference.CatalogCategories.all()
    for (const cat of categories) {
      if (cat.id === 'guides') {
        expect(cat.flat).toBe(true)
      } else {
        expect(cat.flat).toBe(false)
      }
    }
  })

  it('should have nonflat categories before flat categories', () => {
    const categories = SalvageUnionReference.CatalogCategories.all()
    const firstFlatIndex = categories.findIndex((c) => c.flat)
    const lastNonflatIndex =
      categories.length - 1 - [...categories].reverse().findIndex((c) => !c.flat)
    expect(firstFlatIndex).toBeGreaterThan(lastNonflatIndex)
  })

  it('should not be in EntitySchemaNames', () => {
    expect(EntitySchemaNames.has('catalog-categories')).toBe(false)
  })
})

describe('SalvageUnionReference public API surface', () => {
  it('should NOT expose findUsagesOf (removed as unused)', () => {
    expect('findUsagesOf' in SalvageUnionReference).toBe(false)
  })

  it('should NOT expose composeRef (removed as unused)', () => {
    expect('composeRef' in SalvageUnionReference).toBe(false)
  })

  it('should NOT expose getManyByRef (removed as unused)', () => {
    expect('getManyByRef' in SalvageUnionReference).toBe(false)
  })
})

describe('getSlotsRequired', () => {
  it('should get slots required from systems', () => {
    const system = defined(SalvageUnionReference.Systems.all()[0])
    const slots = getSlotsRequired(system)

    expect(slots).toBeDefined()
    expect(typeof slots).toBe('number')
    expect(slots).toBe(system.slotsRequired)
  })

  it('should return undefined for entities without slots required', () => {
    const ability = defined(SalvageUnionReference.Abilities.all()[0])
    const slots = getSlotsRequired(ability)

    expect(slots).toBeUndefined()
  })
})
