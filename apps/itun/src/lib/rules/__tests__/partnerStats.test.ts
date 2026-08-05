/**
 * The partner tech-level rule has two branches that produce plausible-looking
 * stats either way, so getting it wrong fails silently rather than loudly.
 * These tests pin it against the Core Book's actual wording:
 *
 *   - PILOT-granted partners take the UNION CRAWLER's tech level (p. 29/48/68),
 *     not the pilot's and not their own printed base row, and Mecha Companion
 *     floors at Tech 3 (p. 68).
 *   - MECH-granted drones are FIXED (Sestra Drone Tech 3, Big Brother Drone
 *     Tech 5) and carry no `bonusPerTechLevel` at all.
 *
 * They also pin the `hostSchema` disambiguation, which exists because "Survey
 * Drone" is a record in BOTH equipment.json (the player's partner) and
 * drones.json (an opposition stat block) with completely different stats.
 */

import { describe, expect, test } from 'bun:test'
import type { PartnerInstance } from '../../schemas/partner'
import {
  partnerCap,
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../partnerStats'

const partner = (over: Partial<PartnerInstance>): PartnerInstance => ({
  id: 'p1',
  hostRef: 'survey-drone',
  hostSchema: 'equipment',
  systems: [],
  modules: [],
  conditions: [],
  ...over,
})

describe('resolvePartnerStatBlock — hostSchema disambiguation', () => {
  test('"survey-drone" resolves to the EQUIPMENT record, not the opposition drone', () => {
    const block = resolvePartnerStatBlock(partner({ hostSchema: 'equipment' })) as Record<
      string,
      unknown
    >
    expect(block).toBeTruthy()
    // The player's Survey Drone is mech-shaped: EP and slots.
    expect(block.structurePoints).toBe(2)
    expect(block.energyPoints).toBe(4)
    expect(block.systemSlots).toBe(3)
  })

  test('the SAME slug under hostSchema "drones" resolves to the opposition stat block', () => {
    const block = resolvePartnerStatBlock(partner({ hostSchema: 'drones' })) as Record<
      string,
      unknown
    >
    expect(block).toBeTruthy()
    // Structure points only — this is why hostSchema cannot be inferred.
    expect(block.structurePoints).toBe(1)
    expect(block.energyPoints).toBeUndefined()
    expect(block.systemSlots).toBeUndefined()
  })

  test('an unresolvable ref returns null rather than throwing', () => {
    expect(resolvePartnerStatBlock(partner({ hostRef: 'no-such-partner' }))).toBeNull()
  })
})

describe('partnerTechLevel — pilot-granted tracks the Union Crawler', () => {
  test('takes the crawler tech level, NOT the stat block base of 1', () => {
    expect(partnerTechLevel(partner({ hostRef: 'auto-turret' }), 4)).toBe(4)
  })

  test('degrades to the base tech level when the pilot has no crawler', () => {
    expect(partnerTechLevel(partner({ hostRef: 'auto-turret' }), undefined)).toBe(1)
  })

  test('Mecha Companion floors at Tech 3 even on a Tech 1 crawler', () => {
    expect(partnerTechLevel(partner({ hostRef: 'mecha-companion' }), 1)).toBe(3)
  })

  test('…but a higher crawler still wins over the floor', () => {
    expect(partnerTechLevel(partner({ hostRef: 'mecha-companion' }), 5)).toBe(5)
  })

  test('the floor does NOT leak to other pilot-granted partners', () => {
    expect(partnerTechLevel(partner({ hostRef: 'survey-drone' }), 1)).toBe(1)
  })
})

describe('partnerTechLevel — mech-granted drones are fixed', () => {
  test('Sestra Drone stays Tech 3 regardless of the crawler', () => {
    const sestra = partner({ hostRef: 'sestra-drone', hostSchema: 'drones' })
    expect(partnerTechLevel(sestra, 6)).toBe(3)
    expect(partnerTechLevel(sestra, 1)).toBe(3)
    expect(partnerTechLevel(sestra, undefined)).toBe(3)
  })

  test('Big Brother Drone stays Tech 5', () => {
    const bb = partner({ hostRef: 'big-brother-drone', hostSchema: 'drones' })
    expect(partnerTechLevel(bb, 2)).toBe(5)
  })
})

describe('partnerTechLevel — override', () => {
  test('an explicit override beats both branches (Free-Edit surface, ADR-021)', () => {
    expect(
      partnerTechLevel(
        partner({ hostRef: 'sestra-drone', hostSchema: 'drones', techLevelOverride: 6 }),
        1
      )
    ).toBe(6)
    expect(partnerTechLevel(partner({ hostRef: 'mecha-companion', techLevelOverride: 1 }), 5)).toBe(
      1
    )
  })
})

describe('partnerDerivedStats', () => {
  test('Tech 1 is the printed base row — the bonus applies "for each level ABOVE the first"', () => {
    const stats = partnerDerivedStats(partner({ hostRef: 'survey-drone' }), 1)
    expect(stats.structurePoints).toBe(2)
    expect(stats.energyPoints).toBe(4)
    expect(stats.systemSlots).toBe(3)
  })

  test('Tech 3 applies the per-level bonus exactly twice', () => {
    // Survey Drone: SP 2 (+2/level), EP 4 (+2), slots 3 (+1), modules 1 (+1).
    const stats = partnerDerivedStats(partner({ hostRef: 'survey-drone' }), 3)
    expect(stats.structurePoints).toBe(2 + 2 * 2)
    expect(stats.energyPoints).toBe(4 + 2 * 2)
    expect(stats.systemSlots).toBe(3 + 1 * 2)
    expect(stats.moduleSlots).toBe(1 + 1 * 2)
  })

  test('a mech-granted drone has no bonusPerTechLevel, so it never scales', () => {
    const sestra = partner({ hostRef: 'sestra-drone', hostSchema: 'drones' })
    expect(partnerDerivedStats(sestra, 3)).toEqual(partnerDerivedStats(sestra, 6))
    expect(partnerDerivedStats(sestra, 3).structurePoints).toBe(7)
  })

  test('an unresolvable partner yields zeroes rather than NaN', () => {
    const stats = partnerDerivedStats(partner({ hostRef: 'no-such-partner' }), 4)
    expect(Object.values(stats).every((v) => v === 0)).toBe(true)
  })
})

describe('partnerCap', () => {
  test('every partner is capped at one by default', () => {
    expect(partnerCap('auto-turret', [])).toBe(1)
    expect(partnerCap('survey-drone', [])).toBe(1)
    expect(partnerCap('mecha-companion', [])).toBe(1)
  })

  test('Mecha Packmaster raises the Mecha Companion cap to two', () => {
    expect(partnerCap('mecha-companion', ['mecha-companion', 'mecha-packmaster'])).toBe(2)
  })

  test('Packmaster does not raise any OTHER partner cap', () => {
    expect(partnerCap('auto-turret', ['mecha-packmaster'])).toBe(1)
  })
})
