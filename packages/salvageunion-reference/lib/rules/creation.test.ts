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
import type { SURefAbility, SURefClass, SURefEquipment } from '../schemas/index.js'
import {
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  isLegalCreationAbility,
  isLegalCreationClass,
  isLegalCreationEquipment,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
  legalCreationAbilities,
  pilotAbilityPicksRemaining,
  pilotEquipmentPicksRemaining,
} from './creation.js'

beforeAll(async () => {
  await SalvageUnionReference.preload(['classes', 'abilities', 'equipment'])
})

const CORE_CLASS_NAMES = ['Engineer', 'Hacker', 'Hauler', 'Salvager', 'Scout', 'Soldier'] as const

function classByName(name: string): SURefClass {
  const cls = SalvageUnionReference.Classes.find((c) => c.name === name)
  if (!cls) throw new Error(`class "${name}" not found`)
  return cls
}

/** Narrows to the base-class branch of the class union (has coreTrees). */
function coreClassByName(name: string): SURefClass & { coreTrees: readonly string[] } {
  const cls = classByName(name)
  if (!('coreTrees' in cls)) throw new Error(`class "${name}" has no coreTrees`)
  return cls as SURefClass & { coreTrees: readonly string[] }
}

function allAbilities(): SURefAbility[] {
  return SalvageUnionReference.Abilities.all() as SURefAbility[]
}

describe('isLegalCreationClass', () => {
  it('accepts exactly the six core classes', () => {
    const legal = SalvageUnionReference.Classes.all().filter((c) => isLegalCreationClass(c))
    expect(legal.map((c) => c.name).sort()).toEqual([...CORE_CLASS_NAMES].sort())
  })

  it('rejects Advanced/Hybrid specialisation classes (no coreTrees)', () => {
    for (const name of ['Fabricator', 'Cyborg', 'Union Rep', 'Smuggler', 'Ranger']) {
      expect(isLegalCreationClass(classByName(name))).toBe(false)
    }
  })

  it('rejects null/undefined and empty coreTrees', () => {
    expect(isLegalCreationClass(null)).toBe(false)
    expect(isLegalCreationClass(undefined)).toBe(false)
    expect(isLegalCreationClass({ coreTrees: [] })).toBe(false)
  })
})

describe('legalCreationAbilities', () => {
  it("Salvager's legal pool is EXACTLY the 15 core-tree Level-1 abilities", () => {
    const salvager = coreClassByName('Salvager')
    expect(salvager.coreTrees.length).toBe(15)

    const pool = legalCreationAbilities(allAbilities(), salvager)
    expect(pool.length).toBe(15)

    // Every entry is Level 1 in one of the Salvager's 15 core trees…
    for (const ability of pool) {
      expect(ability.level).toBe(1)
      expect(salvager.coreTrees).toContain(ability.tree)
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
    const soldier = classByName('Soldier')
    const pool = legalCreationAbilities(allAbilities(), soldier)
    expect(pool.length).toBe(3)
    expect(pool.map((a) => String(a.tree)).sort()).toEqual(
      ['Gladiatorial Combat', 'Survivalist', 'Tactical Warfare'].sort()
    )
    for (const ability of pool) expect(ability.level).toBe(1)
  })

  it('a specialisation class has an EMPTY legal creation pool', () => {
    const cyborg = classByName('Cyborg')
    expect(legalCreationAbilities(allAbilities(), cyborg)).toEqual([])
  })

  it('excludes higher-level abilities of a legal core tree', () => {
    const engineer = classByName('Engineer')
    const level2 = allAbilities().find(
      (a) => a.tree === 'Mechanical Knowledge' && a.level === 2
    ) as SURefAbility
    expect(level2).toBeDefined()
    expect(isLegalCreationAbility(level2, engineer)).toBe(false)
  })

  it("excludes another core class's tree Level-1s", () => {
    const engineer = classByName('Engineer')
    const soldierL1 = allAbilities().find(
      (a) => a.tree === 'Gladiatorial Combat' && a.level === 1
    ) as SURefAbility
    expect(soldierL1).toBeDefined()
    expect(isLegalCreationAbility(soldierL1, engineer)).toBe(false)
  })
})

describe('isLegalCreationEquipment', () => {
  it('accepts Tech 1 and rejects every higher tier in the real catalog', () => {
    const equipment = SalvageUnionReference.Equipment.all() as SURefEquipment[]
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
    expect(pilotAbilityPicksRemaining(0)).toBe(1)
    expect(pilotAbilityPicksRemaining(1)).toBe(0)
    expect(pilotAbilityPicksRemaining(5)).toBe(0)
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
