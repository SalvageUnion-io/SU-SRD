/**
 * Unit tests for derivedStats.ts — derived maxima for all three entities
 * (plan 2.5). The pilot max-HP derivation is rules-critical and pinned:
 *
 *   maxHP = 10 + maxHpModifier − Σ(minor injury: 1, major injury: 2)
 *
 * Mech maxima use a hand-crafted chassis; crawler max SP uses REAL
 * crawler-tech-levels data from salvageunion-reference.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import type { ChassisStats } from './derivedStats.js'
import {
  clampCrawlerCurrentStats,
  clampMechCurrentStats,
  clampPilotCurrentStats,
  crawlerMaxSP,
  crawlerMaxSPParts,
  injuryMaxHpPenalty,
  isPilotDead,
  mechMaxCargo,
  mechMaxCargoParts,
  mechMaxEP,
  mechMaxHeat,
  mechMaxHeatParts,
  mechMaxSP,
  mechMaxSPParts,
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
  pilotMaxAP,
  pilotMaxHP,
  pilotMaxHPParts,
  pilotMaxInventorySlots,
  pilotMaxInventorySlotsParts,
  unifiedMechConditions,
} from './derivedStats.js'

beforeAll(async () => {
  await SalvageUnionReference.preload([
    'crawler-tech-levels',
    'crawlers',
    'chassis',
    'systems',
    'modules',
    'abilities',
  ])
})

// ---------------------------------------------------------------------------
// Pilot
// ---------------------------------------------------------------------------

describe('pilot derivation', () => {
  it('base pilot: maxHP 10, maxAP 5', () => {
    const pilot = {}
    expect(pilotMaxHP(pilot)).toBe(PILOT_BASE_HP)
    expect(pilotMaxAP(pilot)).toBe(PILOT_BASE_AP)
  })

  it('injury penalties: minor −1, major −2, stacking', () => {
    expect(injuryMaxHpPenalty([{ severity: 'minor', note: '' }])).toBe(1)
    expect(injuryMaxHpPenalty([{ severity: 'major', note: '' }])).toBe(2)
    expect(
      injuryMaxHpPenalty([
        { severity: 'minor', note: 'shrapnel' },
        { severity: 'minor', note: 'burns' },
        { severity: 'major', note: 'poison' },
      ])
    ).toBe(4)
    expect(injuryMaxHpPenalty(undefined)).toBe(0)
  })

  it('pinned formula: maxHP = 10 + modifier − injuries', () => {
    const pilot = {
      maxHpModifier: 4, // two Stat Training tiers
      injuries: [
        { severity: 'minor' as const, note: '' },
        { severity: 'major' as const, note: '' },
      ],
    }
    expect(pilotMaxHP(pilot)).toBe(10 + 4 - 3)
  })

  it('maxAP = 5 + modifier', () => {
    expect(pilotMaxAP({ maxApModifier: 2 })).toBe(7)
  })

  it('dead state: maxHP ≤ 0 — not clamped away', () => {
    const dying = {
      injuries: Array.from({ length: 5 }, () => ({
        severity: 'major' as const,
        note: '',
      })),
    }
    expect(pilotMaxHP(dying)).toBe(0)
    expect(isPilotDead(dying)).toBe(true)
    expect(isPilotDead({})).toBe(false)
  })

  it('clamps current HP/AP down to the derived maxima', () => {
    const pilot = {
      maxHpModifier: 0,
      injuries: [{ severity: 'major' as const, note: '' }], // maxHP 8
      currentHP: 10,
      currentAP: 5,
    }
    expect(clampPilotCurrentStats(pilot)).toEqual({ currentHP: 8 })
  })

  it('returns an empty patch when nothing exceeds the maxima', () => {
    expect(clampPilotCurrentStats({ currentHP: 3, currentAP: 2 })).toEqual({})
    expect(clampPilotCurrentStats({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Mech
// ---------------------------------------------------------------------------

const chassis: ChassisStats = {
  structurePoints: 10,
  energyPoints: 6,
  heatCapacity: 5,
  cargoCapacity: 6,
}

describe('mech derivation', () => {
  const bare = { chassisRef: 'no-such-chassis' }

  it('maxima = chassis stat + modifier (heat sinks, capacitance banks, armour, holds)', () => {
    const mech = {
      ...bare,
      maxSpModifier: 5, // Composite Armour
      maxEpModifier: 2, // Capacitance Bank
      maxHeatModifier: 1, // Heat Sink
      maxCargoModifier: 4, // Storage Hold
    }
    expect(mechMaxSP(mech, chassis)).toBe(15)
    expect(mechMaxEP(mech, chassis)).toBe(8)
    expect(mechMaxHeat(mech, chassis)).toBe(6)
    expect(mechMaxCargo(mech, chassis)).toBe(10)
  })

  it('modifiers default to 0 when absent', () => {
    expect(mechMaxSP(bare, chassis)).toBe(10)
    expect(mechMaxEP(bare, chassis)).toBe(6)
    expect(mechMaxHeat(bare, chassis)).toBe(5)
    expect(mechMaxCargo(bare, chassis)).toBe(6)
  })

  it('negative modifiers floor at 0, never negative maxima', () => {
    expect(mechMaxSP({ ...bare, maxSpModifier: -99 }, chassis)).toBe(0)
  })

  it('resolves the chassis by NAME from the reference ORM when not injected', () => {
    const real = SalvageUnionReference.Chassis.all()[0]
    expect(real).toBeDefined()
    if (!real) return
    const mech = { chassisRef: real.name, maxSpModifier: 1 }
    expect(mechMaxSP(mech)).toBe((real.structurePoints ?? 0) + 1)
  })

  it('clamps current SP/EP/Heat to derived maxima', () => {
    const mech = {
      ...bare,
      maxHeatModifier: -1, // heat cap shrank to 4
      currentSP: 12,
      currentEP: 6,
      currentHeat: 5,
    }
    expect(clampMechCurrentStats(mech, chassis)).toEqual({
      currentSP: 10,
      currentHeat: 4,
    })
  })
})

// ---------------------------------------------------------------------------
// Installed system/module contributions (data-driven, real ORM items).
//
// Reference data (packages/salvageunion-reference/data/systems.json) — each of
// these declares ONE `contributions` entry, `target: 'self'`:
//   Cargo Pod        -> cargoCapacity   +1  (Core Book p.164)
//   Transport Hold   -> cargoCapacity   +4  (Core Book p.168)
//   Heat Sink        -> heatCapacity    +1  (Core Book p.170)
//   Capacitance Bank -> energyPoints    +2  (Core Book p.173)
//   Composite Armour -> structurePoints +5  (Core Book p.173)
// ---------------------------------------------------------------------------
describe('cap overrides — absolute pins (ADR-022 amendment)', () => {
  const bare = { chassisRef: 'no-such-chassis' }

  it('a pin replaces the derived total and retains the baseline', () => {
    const parts = mechMaxSPParts({ ...bare, systems: ['Heat Sink'], maxSpOverride: 40 }, chassis)
    expect(parts.total).toBe(40)
    expect(parts.overridden).toBe(true)
    expect(parts.override).toBe(40)
    // The derivation keeps running underneath so revert has a target.
    expect(parts.derived).toBe(10)
    expect(parts.base).toBe(10)
  })

  it('a manual adjustment CONTRIBUTES rather than replacing', () => {
    const parts = mechMaxSPParts({ ...bare, maxSpModifier: 3 }, chassis)
    expect(parts.adjustment).toBe(3)
    expect(parts.derived).toBe(13)
    expect(parts.total).toBe(13)
    expect(parts.overridden).toBe(false)
    expect(parts.override).toBeUndefined()
  })

  it('a pin and an adjustment coexist — the pin wins, the adjustment stays visible', () => {
    const parts = mechMaxSPParts({ ...bare, maxSpModifier: 3, maxSpOverride: 25 }, chassis)
    expect(parts.total).toBe(25)
    expect(parts.derived).toBe(13)
    expect(parts.adjustment).toBe(3)
  })

  it('a pin of 0 is honoured, not treated as absent', () => {
    const parts = mechMaxSPParts({ ...bare, maxSpOverride: 0 }, chassis)
    expect(parts.overridden).toBe(true)
    expect(parts.total).toBe(0)
  })

  it('pilot max HP stays unclamped so the dead state survives a lethal injury total', () => {
    const parts = pilotMaxHPParts({
      injuries: [
        { severity: 'major' as const, note: '' },
        { severity: 'major' as const, note: '' },
        { severity: 'major' as const, note: '' },
        { severity: 'major' as const, note: '' },
        { severity: 'major' as const, note: '' },
        { severity: 'major' as const, note: '' },
      ],
    })
    expect(parts.total).toBeLessThanOrEqual(0)
    expect(
      isPilotDead({
        injuries: [
          { severity: 'major' as const, note: '' },
          { severity: 'major' as const, note: '' },
          { severity: 'major' as const, note: '' },
          { severity: 'major' as const, note: '' },
          { severity: 'major' as const, note: '' },
          { severity: 'major' as const, note: '' },
        ],
      })
    ).toBe(true)
  })

  it('a pilot HP pin overrides the injury penalty', () => {
    const parts = pilotMaxHPParts({
      injuries: [{ severity: 'major' as const, note: '' }],
      maxHpOverride: 12,
    })
    expect(parts.total).toBe(12)
    expect(parts.derived).toBe(8)
  })
})

describe('pilot inventory capacity', () => {
  // Pins the equivalence with the derivation this replaced (ITUN's
  // pilotInventoryCapacity): base 6 + maxInventorySlotsModifier + ability
  // contributions, floored at 0 — plus the override path that field never had.
  it('is the rules base with no modifiers', () => {
    expect(pilotMaxInventorySlots({})).toBe(PILOT_BASE_INVENTORY_SLOTS)
    expect(PILOT_BASE_INVENTORY_SLOTS).toBe(6)
  })

  it('adds the hand-edited modifier', () => {
    expect(pilotMaxInventorySlots({ maxInventorySlotsModifier: 2 })).toBe(8)
  })

  it('never goes below 0', () => {
    expect(pilotMaxInventorySlots({ maxInventorySlotsModifier: -20 })).toBe(0)
  })

  it("applies Beefcake's +4 inventorySlots as a NAMED source, not an anonymous total", () => {
    const parts = pilotMaxInventorySlotsParts({ abilities: ['Beefcake'] })
    expect(parts.total).toBe(10)
    expect(parts.base).toBe(6)
    expect(parts.sources.map((s) => [s.source, s.amount])).toEqual([['Beefcake', 4]])
  })

  it('honours maxInventorySlotsOverride as an absolute pin, retaining the derived value', () => {
    const parts = pilotMaxInventorySlotsParts({
      abilities: ['Beefcake'],
      maxInventorySlotsModifier: 1,
      maxInventorySlotsOverride: 3,
    })
    expect(parts.overridden).toBe(true)
    expect(parts.total).toBe(3)
    expect(parts.derived).toBe(11)
  })

  it('a pin of 0 is honoured, not treated as absent', () => {
    const parts = pilotMaxInventorySlotsParts({ maxInventorySlotsOverride: 0 })
    expect(parts.overridden).toBe(true)
    expect(parts.total).toBe(0)
  })
})

describe('installed system/module contributions', () => {
  const bare = { chassisRef: 'no-such-chassis' }
  // These totals are unchanged from when the same nine systems declared a flat
  // `statBonus` summed by `installedStatBonus`. The convergence onto
  // `contributions` moves them from the ANONYMOUS `installed` slot into named
  // `sources`, so the numbers below pin that the arithmetic did not move.
  const sourceOf = (parts: { sources: { source: string; amount: number }[] }) =>
    parts.sources.map((s) => [s.source, s.amount])

  it('sums a single installed item contribution into the relevant maximum', () => {
    const mech = { ...bare, systems: ['Cargo Pod'] }
    // base cargoCapacity 6 + Cargo Pod +1 = 7
    expect(mechMaxCargo(mech, chassis)).toBe(7)
    const parts = mechMaxCargoParts(mech, chassis)
    expect(parts.installed).toBe(0)
    expect(sourceOf(parts)).toEqual([['Cargo Pod', 1]])
  })

  it('stacks contributions across multiple installed copies (2x Heat Sink = +2)', () => {
    const mech = { ...bare, systems: ['Heat Sink', 'Heat Sink'] }
    // base heatCapacity 5 + 2 Heat Sinks (+1 each) = 7
    expect(mechMaxHeat(mech, chassis)).toBe(7)
    const parts = mechMaxHeatParts(mech, chassis)
    expect(sourceOf(parts)).toEqual([['Heat Sink', 2]])
    expect(parts.sources[0]?.copies).toBe(2)
  })

  it('applies Composite Armour +5 Max SP, per installed copy', () => {
    // Its rules text -- "increases your Mech's Max SP by 5 for each Composite
    // Armour System you have installed" -- is a flat per-copy contribution.
    const one = { ...bare, systems: ['Composite Armour'] }
    expect(mechMaxSP(one, chassis)).toBe(15) // base 10 + 5
    expect(sourceOf(mechMaxSPParts(one, chassis))).toEqual([['Composite Armour', 5]])

    const two = { ...bare, systems: ['Composite Armour', 'Composite Armour'] }
    expect(mechMaxSP(two, chassis)).toBe(20) // base 10 + 5 + 5
    expect(sourceOf(mechMaxSPParts(two, chassis))).toEqual([['Composite Armour', 10]])
  })

  it('adds installed contributions on top of the hand-edited modifier', () => {
    const mech = {
      ...bare,
      maxEpModifier: 1,
      systems: ['Capacitance Bank', 'Capacitance Bank'],
    }
    // base energyPoints 6 + modifier 1 + 2 banks (+2 each = +4) = 11
    expect(mechMaxEP(mech, chassis)).toBe(11)
  })

  it('mixes system and module refs and ignores unresolved / no-contribution items', () => {
    const mech = {
      ...bare,
      systems: ['Cargo Pod', 'Transport Hold', 'Made Up System'],
      modules: [],
    }
    // base 6 + Cargo Pod 1 + Transport Hold 4 = 11; unknown item contributes 0
    expect(mechMaxCargo(mech, chassis)).toBe(11)
  })

  it('contributes 0 when no installed lists are provided', () => {
    const parts = mechMaxCargoParts(bare, chassis)
    expect(parts.sources).toEqual([])
    expect(parts.installed).toBe(0)
    expect(mechMaxCargo(bare, chassis)).toBe(6)
  })
})

describe('unifiedMechConditions', () => {
  it('merges boolean flags into the conditions vocabulary', () => {
    expect(
      unifiedMechConditions({
        conditions: ['Prone'],
        shutdown: true,
        vulnerable: true,
        destroyed: false,
      })
    ).toEqual(['Prone', 'Shutdown', 'Vulnerable'])
  })

  it('deduplicates case-insensitively against conditions[]', () => {
    expect(unifiedMechConditions({ conditions: ['vulnerable'], vulnerable: true })).toEqual([
      'vulnerable',
    ])
  })

  it('returns conditions[] untouched when no flags are set', () => {
    expect(unifiedMechConditions({ conditions: ['Burn (2)'] })).toEqual(['Burn (2)'])
  })
})

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

describe('crawler derivation', () => {
  it('max SP comes from the tech level ORM record (no slug regex fallback to 0-pips)', () => {
    const tl3 = SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === 3)
    expect(tl3).toBeDefined()
    expect(crawlerMaxSP({ techLevel: 'tech-3' })).toBe(tl3?.structurePoints ?? -1)
  })

  it('maxSpModifier is a pure hand-edit bonus on top of the base', () => {
    const base = crawlerMaxSP({ techLevel: 'tech-1' })
    expect(crawlerMaxSP({ techLevel: 'tech-1', maxSpModifier: 5 })).toBe(base + 5)
  })

  it('the Battle type’s +5 applies AT READ from its stored max_sp_bonus mutation', () => {
    const battle = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')
    expect(battle).toBeDefined()
    const base = crawlerMaxSP({ techLevel: 'tech-1' })
    // By id AND by name (stored type refs resolve id-or-name, like bay refs).
    expect(crawlerMaxSP({ techLevel: 'tech-1', type: battle?.id })).toBe(base + 5)
    expect(crawlerMaxSP({ techLevel: 'tech-1', type: 'Battle' })).toBe(base + 5)
    // A type swap re-derives in BOTH directions — no stored residue.
    expect(crawlerMaxSP({ techLevel: 'tech-1', type: 'Engineering' })).toBe(base)
  })

  it('type bonus stacks with the hand-edit modifier, decomposed by crawlerMaxSPParts', () => {
    const battle = SalvageUnionReference.Crawlers.find((c) => c.name === 'Battle')
    const parts = crawlerMaxSPParts({
      techLevel: 'tech-1',
      type: battle?.id,
      maxSpModifier: 2,
    })
    expect(parts.base).toBe(20)
    expect(parts.typeBonus).toBe(5)
    expect(parts.adjustment).toBe(2)
    expect(parts.total).toBe(27)
  })

  it('an unresolvable type ref contributes no bonus', () => {
    const base = crawlerMaxSP({ techLevel: 'tech-1' })
    expect(crawlerMaxSP({ techLevel: 'tech-1', type: 'no-such-type' })).toBe(base)
  })

  it('unresolvable techLevel slug yields the modifier alone (≥ 0)', () => {
    expect(crawlerMaxSP({ techLevel: 'garbage' })).toBe(0)
    expect(crawlerMaxSP({ techLevel: 'garbage', maxSpModifier: 5 })).toBe(5)
  })

  it('clamps current SP to the derived max', () => {
    const max = crawlerMaxSP({ techLevel: 'tech-1' })
    expect(clampCrawlerCurrentStats({ techLevel: 'tech-1', currentSP: max + 10 })).toEqual({
      currentSP: max,
    })
    expect(clampCrawlerCurrentStats({ techLevel: 'tech-1', currentSP: max })).toEqual({})
  })
})
