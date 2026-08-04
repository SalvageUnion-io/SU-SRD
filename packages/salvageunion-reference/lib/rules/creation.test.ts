/**
 * Unit tests for creation.ts — Pilot Bay creation legality (Core Book
 * pp.18–19, wizard-refresh Phase 3).
 *
 * Uses REAL data from salvageunion-reference so the legality predicates are
 * verified against the actual class/ability/equipment catalog — including the
 * plan's explicit Salvager assertion: the legal creation pool is EXACTLY the
 * 15 core-tree Level-1 abilities.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import type { SURefAbility, SURefChassis, SURefClass, SURefEquipment } from '../schemas/index.js'
import {
  CRAWLER_CREATION_MIN_WEAPONS,
  CRAWLER_CREATION_TECH_LEVEL,
  crawlerMaxSpBonus,
  crawlerWeaponSlots,
  isCrawlerWeaponPickComplete,
  isLegalCreationAbility,
  isLegalCreationChassis,
  isLegalCreationClass,
  isLegalCreationCrawlerWeapon,
  isLegalCreationEquipment,
  isLegalCreationModule,
  isLegalCreationSystem,
  isLegalStartingPattern,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
  legalCreationAbilities,
  legalStartingPatterns,
  MECH_CREATION_SCRAP_CAP,
  mechCreationBudget,
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  pilotEquipmentPicksRemaining,
} from './creation.js'

beforeAll(async () => {
  await SalvageUnionReference.preload([
    'classes',
    'abilities',
    'equipment',
    'chassis',
    'systems',
    'modules',
  ])
})

const CORE_CLASS_NAMES = ['Engineer', 'Hacker', 'Hauler', 'Salvager', 'Scout', 'Soldier'] as const

function classByName(name: string): SURefClass {
  const cls = SalvageUnionReference.Classes.find((c) => c.name === name)
  if (!cls) throw new Error(`class "${name}" not found`)
  return cls
}

/** Narrow away `undefined` from a lookup; throws (failing the test) when missing. */
function mustFind<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} not found`)
  return value
}

/**
 * The neutral input the predicates take: a class's core trees, or `undefined`
 * for a specialisation class that has none (narrowed off the class union).
 */
function coreTreesOf(name: string): readonly string[] | undefined {
  const cls = classByName(name)
  return 'coreTrees' in cls ? cls.coreTrees : undefined
}

function allAbilities(): SURefAbility[] {
  return SalvageUnionReference.Abilities.all()
}

describe('isLegalCreationClass', () => {
  it('accepts exactly the six core classes', () => {
    const legal = SalvageUnionReference.Classes.all().filter((c) =>
      isLegalCreationClass('coreTrees' in c ? c.coreTrees : undefined)
    )
    expect(legal.map((c) => c.name).sort()).toEqual([...CORE_CLASS_NAMES].sort())
  })

  it('rejects Advanced/Hybrid specialisation classes (no coreTrees)', () => {
    for (const name of ['Fabricator', 'Cyborg', 'Union Rep', 'Smuggler', 'Ranger']) {
      expect(isLegalCreationClass(coreTreesOf(name))).toBe(false)
    }
  })

  it('rejects undefined and empty coreTrees', () => {
    expect(isLegalCreationClass(undefined)).toBe(false)
    expect(isLegalCreationClass([])).toBe(false)
  })
})

describe('legalCreationAbilities', () => {
  it("Salvager's legal pool is EXACTLY the 15 core-tree Level-1 abilities", () => {
    const salvagerTrees = coreTreesOf('Salvager')
    expect(salvagerTrees?.length).toBe(15)

    const pool = legalCreationAbilities(allAbilities(), salvagerTrees)
    expect(pool.length).toBe(15)

    // Every entry is Level 1 in one of the Salvager's 15 core trees…
    for (const ability of pool) {
      expect(ability.level).toBe(1)
      expect(salvagerTrees).toContain(ability.tree)
    }
    // …one per core tree (the 15 trees each contribute exactly one Level-1)…
    expect(new Set(pool.map((a) => a.tree)).size).toBe(15)
    // …and no Generic, Legendary, or advanced/hybrid-tree Level-1 leaks in.
    for (const ability of pool) {
      expect(ability.level === 'G' || ability.level === 'L').toBe(false)
      expect(ability.tree.startsWith('Advanced')).toBe(false)
      expect(ability.tree.startsWith('Legendary')).toBe(false)
    }
  })

  it('a 3-tree core class gets exactly its 3 Level-1 abilities', () => {
    const pool = legalCreationAbilities(allAbilities(), coreTreesOf('Soldier'))
    expect(pool.length).toBe(3)
    expect(pool.map((a) => String(a.tree)).sort()).toEqual(
      ['Gladiatorial Combat', 'Survivalist', 'Tactical Warfare'].sort()
    )
    for (const ability of pool) expect(ability.level).toBe(1)
  })

  it('a specialisation class has an EMPTY legal creation pool', () => {
    expect(legalCreationAbilities(allAbilities(), coreTreesOf('Cyborg'))).toEqual([])
  })

  it('excludes higher-level abilities of a legal core tree', () => {
    const engineerTrees = coreTreesOf('Engineer')
    const level2 = mustFind(
      allAbilities().find((a) => a.tree === 'Mechanical Knowledge' && a.level === 2),
      'Mechanical Knowledge level-2 ability'
    )
    expect(level2).toBeDefined()
    expect(isLegalCreationAbility(level2, engineerTrees)).toBe(false)
  })

  it("excludes another core class's tree Level-1s", () => {
    const engineerTrees = coreTreesOf('Engineer')
    const soldierL1 = mustFind(
      allAbilities().find((a) => a.tree === 'Gladiatorial Combat' && a.level === 1),
      'Gladiatorial Combat level-1 ability'
    )
    expect(soldierL1).toBeDefined()
    expect(isLegalCreationAbility(soldierL1, engineerTrees)).toBe(false)
  })
})

describe('isLegalCreationEquipment', () => {
  it('accepts Tech 1 and rejects every higher tier in the real catalog', () => {
    const equipment: SURefEquipment[] = SalvageUnionReference.Equipment.all()
    const legal = equipment.filter((e) => isLegalCreationEquipment(e))
    expect(legal.length).toBeGreaterThan(0)
    for (const item of legal) expect(item.techLevel).toBe(1)
    const illegal = equipment.filter((e) => !isLegalCreationEquipment(e))
    for (const item of illegal) expect(item.techLevel === 1).toBe(false)
  })
})

describe('pilot pick budgets (1 ability / 2 equipment)', () => {
  it('encodes the corrected book budgets', () => {
    expect(PILOT_CREATION_ABILITY_PICKS).toBe(1)
    expect(PILOT_CREATION_EQUIPMENT_PICKS).toBe(2)
  })

  it('remaining counts clamp at 0', () => {
    expect(pilotEquipmentPicksRemaining(0)).toBe(2)
    expect(pilotEquipmentPicksRemaining(1)).toBe(1)
    expect(pilotEquipmentPicksRemaining(2)).toBe(0)
    expect(pilotEquipmentPicksRemaining(9)).toBe(0)
  })

  it('completion means EXACTLY the budget — over-budget is not complete', () => {
    expect(isPilotAbilityPickComplete(0)).toBe(false)
    expect(isPilotAbilityPickComplete(1)).toBe(true)
    expect(isPilotAbilityPickComplete(2)).toBe(false)
    expect(isPilotEquipmentPickComplete(1)).toBe(false)
    expect(isPilotEquipmentPickComplete(2)).toBe(true)
    expect(isPilotEquipmentPickComplete(3)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mech Workshop (pp.94–95 — Phase 4)
// ---------------------------------------------------------------------------

describe('isLegalCreationChassis / System / Module (Tech 1 only)', () => {
  it('accepts exactly the Tech 1 chassis in the real catalog', () => {
    const chassis: SURefChassis[] = SalvageUnionReference.Chassis.all()
    const legal = chassis.filter((c) => isLegalCreationChassis(c.techLevel))
    expect(legal.length).toBeGreaterThan(0)
    for (const c of legal) expect(c.techLevel).toBe(1)
    for (const c of chassis.filter((x) => !isLegalCreationChassis(x.techLevel))) {
      expect(c.techLevel === 1).toBe(false)
    }
    // The book's own example chassis is legal.
    const mule = mustFind(
      chassis.find((c) => c.name === 'Mule'),
      'Mule chassis'
    )
    expect(mule).toBeDefined()
    expect(isLegalCreationChassis(mule.techLevel)).toBe(true)
  })

  it('accepts Tech 1 systems/modules and rejects every higher/expansion tier', () => {
    for (const [accessor, predicate] of [
      [SalvageUnionReference.Systems, isLegalCreationSystem],
      [SalvageUnionReference.Modules, isLegalCreationModule],
    ] as const) {
      const items: { techLevel: number | string }[] = accessor.all()
      const legal = items.filter((i) => predicate(i.techLevel))
      expect(legal.length).toBeGreaterThan(0)
      for (const item of legal) expect(item.techLevel).toBe(1)
      // Bio ('B') / Nanite ('N') expansion tiers are never Tech 1.
      for (const item of items.filter((i) => typeof i.techLevel === 'string')) {
        expect(predicate(item.techLevel)).toBe(false)
      }
    }
  })
})

describe('legalStartingPatterns (stored data tag — never computed)', () => {
  it('filters by the stored legalStarting flag only', () => {
    const flagged = { legalStarting: true, name: 'A' }
    const unflagged = { legalStarting: undefined, name: 'B' }
    const explicitFalse = { legalStarting: false, name: 'C' }
    expect(legalStartingPatterns([flagged, unflagged, explicitFalse])).toEqual([flagged])
    expect(isLegalStartingPattern(flagged.legalStarting)).toBe(true)
    expect(isLegalStartingPattern(unflagged.legalStarting)).toBe(false)
    expect(isLegalStartingPattern(explicitFalse.legalStarting)).toBe(false)
  })

  it('every filtered pattern in the real catalog carries the stored flag', () => {
    const chassis: SURefChassis[] = SalvageUnionReference.Chassis.all()
    const allPatterns = chassis.flatMap((c) => c.patterns)
    const legal = legalStartingPatterns(allPatterns)
    expect(legal.length).toBeGreaterThan(0)
    // The tag is a strict subset — some patterns are NOT legal starting.
    expect(legal.length).toBeLessThan(allPatterns.length)
    for (const pattern of legal) expect(pattern.legalStarting).toBe(true)
  })
})

describe('mechCreationBudget (20 Tech 1 Scrap, on scrapCostFor)', () => {
  it('caps at 20 and debits chassis + Σ(sv × count)', () => {
    expect(MECH_CREATION_SCRAP_CAP).toBe(20)
    // The book's own worked example: Mule (SV 7) + Locomotion System (SV 2).
    const budget = mechCreationBudget({
      chassisSV: 7,
      loadout: [
        { sv: 2, count: 1 },
        { sv: 1, count: 3 },
      ],
    })
    expect(budget.cap).toBe(20)
    expect(budget.spent).toBe(12)
    expect(budget.remaining).toBe(8)
  })

  it('an empty budget spends nothing and leaves the full cap', () => {
    const budget = mechCreationBudget({ chassisSV: 0, loadout: [] })
    expect(budget.spent).toBe(0)
    expect(budget.remaining).toBe(20)
  })

  it('perItemAffordable is an exact boundary on the remaining scrap', () => {
    const budget = mechCreationBudget({ chassisSV: 7, loadout: [{ sv: 5, count: 2 }] })
    expect(budget.remaining).toBe(3)
    expect(budget.perItemAffordable(3)).toBe(true)
    expect(budget.perItemAffordable(4)).toBe(false)
    expect(budget.perItemAffordable(0)).toBe(true)
  })

  it('an overspent (out-of-regime) loadout reads honestly negative', () => {
    const budget = mechCreationBudget({ chassisSV: 7, loadout: [{ sv: 6, count: 3 }] })
    expect(budget.spent).toBe(25)
    expect(budget.remaining).toBe(-5)
    expect(budget.perItemAffordable(1)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Union Crawler (Core Book pp.212–213 — wizard-refresh Phase 5)
// ---------------------------------------------------------------------------

describe('isLegalCreationCrawlerWeapon (Tech 1 only, p.213)', () => {
  it('creation is fixed at Tech Level 1', () => {
    expect(CRAWLER_CREATION_TECH_LEVEL).toBe(1)
    expect(isLegalCreationCrawlerWeapon(1)).toBe(true)
    for (const tl of [2, 3, 4, 5, 6]) expect(isLegalCreationCrawlerWeapon(tl)).toBe(false)
  })

  it("the 'B'/'N' expansion tiers are never legal", () => {
    expect(isLegalCreationCrawlerWeapon('B')).toBe(false)
    expect(isLegalCreationCrawlerWeapon('N')).toBe(false)
  })
})

describe('crawlerWeaponSlots / crawlerMaxSpBonus (stored mutations, never string-matched)', () => {
  it('base is 1 Armament-Bay slot with no mutations', () => {
    expect(crawlerWeaponSlots(undefined)).toBe(1)
    expect(crawlerWeaponSlots([])).toBe(1)
  })

  it('the REAL Battle type mutations yield 2 slots and +5 max SP', () => {
    const battle = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')
    expect(battle?.mutations).toBeDefined()
    expect(crawlerWeaponSlots(battle?.mutations)).toBe(2)
    expect(crawlerMaxSpBonus(battle?.mutations)).toBe(5)
  })

  it('every non-Battle type has no mutations — 1 slot, +0 SP', () => {
    const others = SalvageUnionReference.Crawlers.all().filter((c) => c.name !== 'Battle')
    expect(others.length).toBeGreaterThan(0)
    for (const type of others) {
      expect(crawlerWeaponSlots(type.mutations)).toBe(1)
      expect(crawlerMaxSpBonus(type.mutations)).toBe(0)
    }
  })

  it('unrelated mutation rows contribute nothing to either total', () => {
    const rows = [
      { type: 'weapon_slots', value: 1 },
      { type: 'max_sp_bonus', value: 5 },
    ]
    expect(crawlerWeaponSlots(rows.filter((m) => m.type !== 'weapon_slots'))).toBe(1)
    expect(crawlerMaxSpBonus(rows.filter((m) => m.type !== 'max_sp_bonus'))).toBe(0)
  })
})

describe('crawler weapon pick minimum (minimum 1 to advance, p.213)', () => {
  it('zero weapons is incomplete; 1+ satisfies', () => {
    expect(CRAWLER_CREATION_MIN_WEAPONS).toBe(1)
    expect(isCrawlerWeaponPickComplete(0)).toBe(false)
    expect(isCrawlerWeaponPickComplete(1)).toBe(true)
    expect(isCrawlerWeaponPickComplete(2)).toBe(true)
  })
})
