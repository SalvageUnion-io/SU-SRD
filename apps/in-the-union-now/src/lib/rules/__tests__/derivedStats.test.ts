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
import { SalvageUnionReference } from 'salvageunion-reference'

import {
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  clampCrawlerCurrentStats,
  clampMechCurrentStats,
  clampPilotCurrentStats,
  crawlerMaxSP,
  injuryMaxHpPenalty,
  installedStatBonus,
  isPilotDead,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
  unifiedMechConditions,
} from '../derivedStats'
import type { ChassisStats } from '../derivedStats'

beforeAll(async () => {
  await SalvageUnionReference.preload(['crawler-tech-levels', 'chassis', 'systems', 'modules'])
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
// Installed system/module stat bonuses (data-driven, real ORM items).
//
// Reference data (packages/salvageunion-reference/data/systems.json):
//   Cargo Pod        -> statBonus.cargoCapacity = 1  (Core Book p.164)
//   Transport Hold   -> statBonus.cargoCapacity = 4  (Core Book p.168)
//   Heat Sink        -> statBonus.heatCapacity  = 1  (Core Book p.170)
//   Capacitance Bank -> statBonus.energyPoints  = 2  (Core Book p.173)
// ---------------------------------------------------------------------------
describe('installed system/module stat bonuses', () => {
  const bare = { chassisRef: 'no-such-chassis' }

  it('sums a single installed item bonus into the relevant maximum', () => {
    const mech = { ...bare, systems: ['Cargo Pod'] }
    // base cargoCapacity 6 + Cargo Pod +1 = 7
    expect(mechMaxCargo(mech, chassis)).toBe(7)
    expect(installedStatBonus(mech, 'cargoCapacity')).toBe(1)
  })

  it('stacks bonuses across multiple installed copies (2× Heat Sink = +2)', () => {
    const mech = { ...bare, systems: ['Heat Sink', 'Heat Sink'] }
    // base heatCapacity 5 + 2 Heat Sinks (+1 each) = 7
    expect(mechMaxHeat(mech, chassis)).toBe(7)
    expect(installedStatBonus(mech, 'heatCapacity')).toBe(2)
  })

  it('adds installed bonuses on top of the hand-edited modifier', () => {
    const mech = {
      ...bare,
      maxEpModifier: 1,
      systems: ['Capacitance Bank', 'Capacitance Bank'],
    }
    // base energyPoints 6 + modifier 1 + 2 banks (+2 each = +4) = 11
    expect(mechMaxEP(mech, chassis)).toBe(11)
  })

  it('mixes system and module refs and ignores unresolved / no-bonus items', () => {
    const mech = {
      ...bare,
      systems: ['Cargo Pod', 'Transport Hold', 'Made Up System'],
      modules: [],
    }
    // base 6 + Cargo Pod 1 + Transport Hold 4 = 11; unknown item contributes 0
    expect(mechMaxCargo(mech, chassis)).toBe(11)
  })

  it('contributes 0 when no installed lists are provided', () => {
    expect(installedStatBonus(bare, 'cargoCapacity')).toBe(0)
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

  it('Battle Crawler +5 lives in maxSpModifier', () => {
    const base = crawlerMaxSP({ techLevel: 'tech-1' })
    expect(crawlerMaxSP({ techLevel: 'tech-1', maxSpModifier: 5 })).toBe(base + 5)
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
