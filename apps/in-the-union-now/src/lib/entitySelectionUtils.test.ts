import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference, getTechLevel, getSource, getTraits } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { filterAndSplitEntities } from './entitySelectionUtils'

const allSystems = SalvageUnionReference.Systems.all() as SURefEntity[]
const allModules = SalvageUnionReference.Modules.all() as SURefEntity[]
const allChassis = SalvageUnionReference.Chassis.all() as SURefEntity[]

// Empty set = all tech levels selected (matches component convention)
const ALL_TECH_LEVELS = new Set<number | 'B' | 'N'>()

function techLevelOrder(tl: number | string | undefined): number {
  if (tl === undefined) return 0
  if (tl === 'B') return 7
  if (tl === 'N') return 8
  return Number(tl)
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i]!)) return i
  }
  return -1
}

function defaultOpts(overrides: Partial<Parameters<typeof filterAndSplitEntities>[0]> = {}) {
  return {
    entities: allSystems,
    search: '',
    activeTechLevels: ALL_TECH_LEVELS,
    activeSourceFilters: new Set<string>(),
    ...overrides,
  }
}

describe('filterAndSplitEntities', () => {
  describe('search filtering', () => {
    test('returns all entities when search is empty', () => {
      const result = filterAndSplitEntities(defaultOpts())
      expect(result.selectable.length).toBe(allSystems.length)
      expect(result.overCapacity.length).toBe(0)
    })

    test('filters by name (case-insensitive)', () => {
      const result = filterAndSplitEntities(defaultOpts({ search: 'laser' }))
      expect(result.selectable.length).toBeGreaterThan(0)
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string) : ''
        expect(name.toLowerCase()).toContain('laser')
      }
    })

    test('search with leading/trailing whitespace is trimmed', () => {
      const result1 = filterAndSplitEntities(defaultOpts({ search: '  laser  ' }))
      const result2 = filterAndSplitEntities(defaultOpts({ search: 'laser' }))
      expect(result1.selectable.length).toBe(result2.selectable.length)
    })

    test('returns empty for non-matching search', () => {
      const result = filterAndSplitEntities(defaultOpts({ search: 'zzzznotreal' }))
      expect(result.selectable.length).toBe(0)
      expect(result.overCapacity.length).toBe(0)
    })

    test('search is case-insensitive', () => {
      const lower = filterAndSplitEntities(defaultOpts({ search: 'cannon' }))
      const upper = filterAndSplitEntities(defaultOpts({ search: 'CANNON' }))
      const mixed = filterAndSplitEntities(defaultOpts({ search: 'Cannon' }))
      expect(lower.selectable.length).toBe(upper.selectable.length)
      expect(lower.selectable.length).toBe(mixed.selectable.length)
      expect(lower.selectable.length).toBeGreaterThan(0)
    })
  })

  describe('trait-based search', () => {
    test('searching a trait type surfaces entities with that trait', () => {
      const result = filterAndSplitEntities(defaultOpts({ search: 'salvaging' }))
      expect(result.selectable.length).toBeGreaterThan(0)
      // Every result should have "salvaging" in its name or in a trait type
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string).toLowerCase() : ''
        const traits = getTraits(entity)
        const hasTraitMatch = traits?.some((t) => t.type.toLowerCase().includes('salvaging'))
        expect(name.includes('salvaging') || hasTraitMatch).toBe(true)
      }
    })

    test('trait search is case-insensitive', () => {
      const lower = filterAndSplitEntities(defaultOpts({ search: 'melee' }))
      const upper = filterAndSplitEntities(defaultOpts({ search: 'MELEE' }))
      const mixed = filterAndSplitEntities(defaultOpts({ search: 'Melee' }))
      expect(lower.selectable.length).toBe(upper.selectable.length)
      expect(lower.selectable.length).toBe(mixed.selectable.length)
      expect(lower.selectable.length).toBeGreaterThan(0)
    })

    test('trait search returns more results than name-only search for trait terms', () => {
      // "melee" is a trait type — some melee weapons don't have "melee" in their name
      const result = filterAndSplitEntities(defaultOpts({ search: 'melee' }))
      const nameOnlyMatches = result.selectable.filter((e) => {
        const name = 'name' in e ? (e.name as string).toLowerCase() : ''
        return name.includes('melee')
      })
      // There should be more total results than just name matches (trait matches add extras)
      expect(result.selectable.length).toBeGreaterThan(nameOnlyMatches.length)
    })

    test('entities without traits still match by name', () => {
      // Chassis have no traits, search by name should still work
      const result = filterAndSplitEntities(defaultOpts({ entities: allChassis, search: 'iron' }))
      expect(result.selectable.length).toBeGreaterThan(0)
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string).toLowerCase() : ''
        expect(name).toContain('iron')
      }
    })

    test('trait search works across entity types (modules)', () => {
      const result = filterAndSplitEntities(
        defaultOpts({ entities: allModules, search: 'hacking' })
      )
      expect(result.selectable.length).toBeGreaterThan(0)
    })
  })

  describe('tech level filtering', () => {
    test('filters to single tech level', () => {
      const tl1Only = new Set<number | 'B' | 'N'>([1])
      const result = filterAndSplitEntities(defaultOpts({ activeTechLevels: tl1Only }))
      expect(result.selectable.length).toBeGreaterThan(0)
      for (const entity of result.selectable) {
        expect(getTechLevel(entity)).toBe(1)
      }
    })

    test('filters to multiple tech levels', () => {
      const tl12 = new Set<number | 'B' | 'N'>([1, 2])
      const result = filterAndSplitEntities(defaultOpts({ activeTechLevels: tl12 }))
      for (const entity of result.selectable) {
        const tl = getTechLevel(entity)
        expect(tl === 1 || tl === 2).toBe(true)
      }
    })

    test('empty tech level set returns all entities (all selected)', () => {
      const result = filterAndSplitEntities(
        defaultOpts({ activeTechLevels: new Set<number | 'B' | 'N'>() })
      )
      expect(result.selectable.length).toBe(allSystems.length)
    })

    test('all tech levels selected returns all entities', () => {
      const result = filterAndSplitEntities(defaultOpts())
      expect(result.selectable.length).toBe(allSystems.length)
    })

    test('Bio tech level filter works', () => {
      const bioOnly = new Set<number | 'B' | 'N'>(['B'])
      const result = filterAndSplitEntities(defaultOpts({ activeTechLevels: bioOnly }))
      for (const entity of result.selectable) {
        expect(getTechLevel(entity)).toBe('B')
      }
    })
  })

  describe('source filtering', () => {
    test('empty source filter set returns all entities (no source filtering)', () => {
      const result = filterAndSplitEntities(defaultOpts())
      expect(result.selectable.length).toBe(allSystems.length)
    })

    test('filters to a single source', () => {
      const wmOnly = new Set(['Salvage Union Workshop Manual'])
      const result = filterAndSplitEntities(defaultOpts({ activeSourceFilters: wmOnly }))
      expect(result.selectable.length).toBeGreaterThan(0)
      for (const entity of result.selectable) {
        expect(getSource(entity)).toBe('Salvage Union Workshop Manual')
      }
    })

    test('filters to multiple sources', () => {
      const sources = new Set(['Salvage Union Workshop Manual', 'False Flag'])
      const result = filterAndSplitEntities(defaultOpts({ activeSourceFilters: sources }))
      for (const entity of result.selectable) {
        const src = getSource(entity)
        expect(src === 'Salvage Union Workshop Manual' || src === 'False Flag').toBe(true)
      }
    })
  })

  describe('external filter prop', () => {
    test('applies external filter function', () => {
      const result = filterAndSplitEntities(
        defaultOpts({
          filter: (e) => e.name.startsWith('A'),
        })
      )
      expect(result.selectable.length).toBeGreaterThan(0)
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string) : ''
        expect(name.startsWith('A')).toBe(true)
      }
    })

    test('external filter combined with search', () => {
      const result = filterAndSplitEntities(
        defaultOpts({
          search: 'cannon',
          filter: (e) => e.name.includes('120'),
        })
      )
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string) : ''
        expect(name.toLowerCase()).toContain('cannon')
        expect(name).toContain('120')
      }
    })
  })

  describe('tech level sorting', () => {
    test('results are sorted by tech level (1-6, B, N) then alphabetically', () => {
      const result = filterAndSplitEntities(defaultOpts())
      const entities = result.selectable
      for (let i = 1; i < entities.length; i++) {
        const prevTl = getTechLevel(entities[i - 1]!)
        const currTl = getTechLevel(entities[i]!)
        const prevOrder = techLevelOrder(prevTl)
        const currOrder = techLevelOrder(currTl)
        if (prevOrder === currOrder) {
          const prevName = 'name' in entities[i - 1]! ? (entities[i - 1]!.name as string) : ''
          const currName = 'name' in entities[i]! ? (entities[i]!.name as string) : ''
          expect(prevName.localeCompare(currName) <= 0).toBe(true)
        } else {
          expect(prevOrder <= currOrder).toBe(true)
        }
      }
    })

    test('TL1 entities appear before TL2 entities', () => {
      const result = filterAndSplitEntities(defaultOpts())
      const tl1Last = findLastIndex(result.selectable, (e) => getTechLevel(e) === 1)
      const tl2First = result.selectable.findIndex((e) => getTechLevel(e) === 2)
      if (tl1Last >= 0 && tl2First >= 0) {
        expect(tl1Last).toBeLessThan(tl2First)
      }
    })

    test('B and N tech levels appear after TL6', () => {
      const result = filterAndSplitEntities(defaultOpts())
      const tl6Last = findLastIndex(result.selectable, (e) => getTechLevel(e) === 6)
      const bioFirst = result.selectable.findIndex((e) => getTechLevel(e) === 'B')
      const npcFirst = result.selectable.findIndex((e) => getTechLevel(e) === 'N')
      if (tl6Last >= 0 && bioFirst >= 0) {
        expect(tl6Last).toBeLessThan(bioFirst)
      }
      if (tl6Last >= 0 && npcFirst >= 0) {
        expect(tl6Last).toBeLessThan(npcFirst)
      }
    })

    test('over-capacity results are also sorted by tech level', () => {
      const result = filterAndSplitEntities(defaultOpts({ remainingSlots: 1 }))
      expect(result.overCapacity.length).toBeGreaterThan(0)
      for (let i = 1; i < result.overCapacity.length; i++) {
        const prevOrder = techLevelOrder(getTechLevel(result.overCapacity[i - 1]!))
        const currOrder = techLevelOrder(getTechLevel(result.overCapacity[i]!))
        expect(prevOrder <= currOrder).toBe(true)
      }
    })
  })

  describe('capacity splitting', () => {
    test('no splitting when remainingSlots is undefined', () => {
      const result = filterAndSplitEntities(defaultOpts())
      expect(result.overCapacity.length).toBe(0)
      expect(result.selectable.length).toBe(allSystems.length)
    })

    test('splits systems by slot capacity', () => {
      const result = filterAndSplitEntities(defaultOpts({ remainingSlots: 3 }))
      expect(result.selectable.length).toBeGreaterThan(0)
      expect(result.overCapacity.length).toBeGreaterThan(0)

      // All selectable have slotsRequired <= 3
      for (const entity of result.selectable) {
        if ('slotsRequired' in entity) {
          expect((entity.slotsRequired as number) <= 3).toBe(true)
        }
      }

      // All over-capacity have slotsRequired > 3
      for (const entity of result.overCapacity) {
        if ('slotsRequired' in entity) {
          expect((entity.slotsRequired as number) > 3).toBe(true)
        }
      }
    })

    test('total count equals selectable + overCapacity', () => {
      const result = filterAndSplitEntities(defaultOpts({ remainingSlots: 4 }))
      expect(result.selectable.length + result.overCapacity.length).toBe(allSystems.length)
    })

    test('remainingSlots=0 puts all systems in over-capacity', () => {
      const result = filterAndSplitEntities(defaultOpts({ remainingSlots: 0 }))
      // All systems have slotsRequired >= 1, so all should be over-capacity
      expect(result.selectable.length).toBe(0)
      expect(result.overCapacity.length).toBe(allSystems.length)
    })

    test('very high remainingSlots puts all in selectable', () => {
      const result = filterAndSplitEntities(defaultOpts({ remainingSlots: 999 }))
      expect(result.selectable.length).toBe(allSystems.length)
      expect(result.overCapacity.length).toBe(0)
    })

    test('chassis have no slotsRequired — all go to selectable', () => {
      const result = filterAndSplitEntities(
        defaultOpts({ entities: allChassis, remainingSlots: 1 })
      )
      // Chassis don't have slotsRequired, so they should all be selectable
      expect(result.selectable.length).toBe(allChassis.length)
      expect(result.overCapacity.length).toBe(0)
    })
  })

  describe('combined filters', () => {
    test('search + tech level + capacity all applied', () => {
      const result = filterAndSplitEntities(
        defaultOpts({
          search: 'laser',
          activeTechLevels: new Set<number | 'B' | 'N'>([3, 4]),
          remainingSlots: 5,
        })
      )
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string) : ''
        const tl = getTechLevel(entity)
        expect(name.toLowerCase()).toContain('laser')
        expect(tl === 3 || tl === 4).toBe(true)
        if ('slotsRequired' in entity) {
          expect((entity.slotsRequired as number) <= 5).toBe(true)
        }
      }
    })

    test('search + source filter', () => {
      const result = filterAndSplitEntities(
        defaultOpts({
          search: 'cannon',
          activeSourceFilters: new Set(['Salvage Union Workshop Manual']),
        })
      )
      for (const entity of result.selectable) {
        const name = 'name' in entity ? (entity.name as string) : ''
        expect(name.toLowerCase()).toContain('cannon')
        expect(getSource(entity)).toBe('Salvage Union Workshop Manual')
      }
    })
  })

  describe('works with different entity types', () => {
    test('modules', () => {
      const result = filterAndSplitEntities(defaultOpts({ entities: allModules }))
      expect(result.selectable.length).toBe(allModules.length)
    })

    test('chassis', () => {
      const result = filterAndSplitEntities(defaultOpts({ entities: allChassis }))
      expect(result.selectable.length).toBe(allChassis.length)
    })

    test('module capacity splitting works', () => {
      const result = filterAndSplitEntities(
        defaultOpts({ entities: allModules, remainingSlots: 2 })
      )
      expect(result.selectable.length + result.overCapacity.length).toBe(allModules.length)
    })
  })
})
