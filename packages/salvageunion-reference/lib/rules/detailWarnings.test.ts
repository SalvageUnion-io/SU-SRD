/**
 * Unit tests for detailWarnings.ts — the static (unchanged) soft-warning
 * derivation used by the pilot / mech / crawler DETAIL routes.
 *
 * Uses REAL data from salvageunion-reference (preloaded in beforeAll) so the
 * capacity math and weapon-system detection run against the actual dataset.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'

import { crawlerDetailWarnings, mechDetailWarnings, pilotDetailWarnings } from './detailWarnings.js'
import { isWeaponSystem } from './crawlerSystems.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

// ---------------------------------------------------------------------------
// Pilot
// ---------------------------------------------------------------------------

describe('pilotDetailWarnings', () => {
  it('warns when the ability count exceeds the rules cap (illegal build)', () => {
    // 11 abilities with no Salvager class → over the 10 cap. Bare/unknown refs
    // still count toward the cap, so this is deterministic without real data.
    const abilities = Array.from({ length: 11 }, (_, i) => `ability-${i}`)
    const warnings = pilotDetailWarnings({ abilities })

    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('PILOT_ABILITY_CAP_EXCEEDED')
    expect(warnings.every((w) => w.severity === 'warn')).toBe(true)
  })

  it('returns no warnings for a legal (small) build', () => {
    expect(pilotDetailWarnings({ abilities: [] })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Mech
// ---------------------------------------------------------------------------

describe('mechDetailWarnings', () => {
  it('warns when system slot usage exceeds the chassis cap', () => {
    // Mule has 16 system slots. .50 Cal Machine Gun costs 2 slots each; 9 of
    // them = 18 slots > 16 → system-over-slots violation.
    const systems = Array.from({ length: 9 }, () => '.50 Cal Machine Gun')
    const warnings = mechDetailWarnings({ chassisRef: 'Mule', systems, modules: [] })

    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('SYSTEM_OVER_SLOTS')
    expect(warnings.every((w) => w.severity === 'warn')).toBe(true)
  })

  it('returns no warnings for a within-capacity loadout', () => {
    const warnings = mechDetailWarnings({
      chassisRef: 'Mule',
      systems: ['.50 Cal Machine Gun'],
      modules: [],
    })
    expect(warnings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

describe('crawlerDetailWarnings', () => {
  // Two real weapon-system ids from the dataset — confirms stored `systems`
  // (persisted as ids) resolve by `.id` in the helper. Computed inside the
  // tests (after beforeAll preload), not at collection time.
  function weaponSystemIds(): string[] {
    return SalvageUnionReference.Systems.all()
      .filter((s) => isWeaponSystem(s))
      .slice(0, 2)
      .map((s) => s.id)
  }

  it('warns when a non-Battle crawler mounts more than one weapons system', () => {
    const ids = weaponSystemIds()
    expect(ids.length).toBe(2) // sanity: the dataset has ≥2 weapon systems

    // No `type` → not a Battle Crawler → cap of 1 weapons system.
    const warnings = crawlerDetailWarnings({ techLevel: '3', systems: ids })

    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('weapon-systems-over-capacity')
    expect(warnings.every((w) => w.severity === 'warn')).toBe(true)
  })

  it('returns no warnings for a single weapons system', () => {
    const warnings = crawlerDetailWarnings({
      techLevel: '3',
      systems: weaponSystemIds().slice(0, 1),
    })
    expect(warnings).toEqual([])
  })
})
