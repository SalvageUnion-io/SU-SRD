/**
 * Ability contributions (ADR-029).
 *
 * These four abilities state a flat stat change in their rules text and, until
 * this landed, the schema could not express it at all — so the numbers on the
 * sheet were simply wrong for any pilot holding them. The assertions below run
 * against the REAL dataset, so a regression in the data fails here.
 */

import { beforeAll, describe, expect, it } from 'bun:test'

import { SalvageUnionReference } from '../index.js'
import { abilityContributions, resolveAmount, sumContributions } from './contributions.js'
import { mechMaxCargoParts, mechMaxSPParts, pilotMaxHPParts } from './derivedStats.js'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('resolveAmount', () => {
  it('passes a plain integer through', () => {
    expect(resolveAmount(4)).toBe(4)
  })

  it('resolves 3+X against a tech level (Beefcake)', () => {
    expect(resolveAmount({ flat: 3, perTechLevel: 1 }, 4)).toBe(7)
  })

  it('under-counts visibly rather than guessing when the tech level is unknown', () => {
    expect(resolveAmount({ flat: 3, perTechLevel: 1 })).toBe(3)
  })
})

describe('ability contributions resolve from the real dataset', () => {
  it('Bionic Legs grants the pilot +2 Max HP', () => {
    const found = abilityContributions(['Bionic Legs'], 'pilot', 'maxHp')
    expect(sumContributions(found)).toBe(2)
    expect(found[0]?.source).toBe('Bionic Legs')
  })

  it('Bionic Arms grants the pilot +2 Max HP', () => {
    expect(sumContributions(abilityContributions(['Bionic Arms'], 'pilot', 'maxHp'))).toBe(2)
  })

  it('two HP abilities stack across different abilities', () => {
    const both = abilityContributions(['Bionic Arms', 'Bionic Legs'], 'pilot', 'maxHp')
    expect(both).toHaveLength(2)
    expect(sumContributions(both)).toBe(4)
  })

  it('Beefcake targets the PILOT and the PILOTED MECH from one record', () => {
    expect(sumContributions(abilityContributions(['Beefcake'], 'pilot', 'maxHp'))).toBe(2)
    expect(sumContributions(abilityContributions(['Beefcake'], 'pilot', 'inventorySlots'))).toBe(4)
    expect(
      sumContributions(abilityContributions(['Beefcake'], 'pilotedMech', 'cargoCapacity'))
    ).toBe(6)
  })

  it("Beefcake's Max SP scales with the mech's tech level (3+X)", () => {
    const atTl1 = abilityContributions(['Beefcake'], 'pilotedMech', 'structurePoints', 1)
    const atTl5 = abilityContributions(['Beefcake'], 'pilotedMech', 'structurePoints', 5)
    expect(sumContributions(atTl1)).toBe(4)
    expect(sumContributions(atTl5)).toBe(8)
  })

  it('Modular Face Implant grants the pilot a Module Slot', () => {
    expect(
      sumContributions(abilityContributions(['Modular Face Implant'], 'pilot', 'moduleSlots'))
    ).toBe(1)
  })

  it('an unresolvable ability ref contributes 0 rather than throwing', () => {
    expect(abilityContributions(['no-such-ability'], 'pilot', 'maxHp')).toEqual([])
  })

  it('a contribution is only returned for its own target and stat', () => {
    expect(abilityContributions(['Beefcake'], 'pilot', 'structurePoints')).toEqual([])
    expect(abilityContributions(['Bionic Legs'], 'pilotedMech', 'maxHp')).toEqual([])
  })
})

describe('contributions reach the derived maxima', () => {
  it('a pilot holding Bionic Legs has 12 Max HP, not 10', () => {
    expect(pilotMaxHPParts({ abilities: ['Bionic Legs'] }).total).toBe(12)
    expect(pilotMaxHPParts({}).total).toBe(10)
  })

  it('Beefcake raises the piloted mech, and the mech alone cannot know it', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    const chassis = { cargoCapacity: 6 }
    // Without the piloting context the mech derives its own cargo only.
    expect(mechMaxCargoParts(mech, chassis).total).toBe(6)
    // With it, Beefcake's +6 applies.
    expect(mechMaxCargoParts(mech, chassis, { abilities: ['Beefcake'] }).total).toBe(12)
  })

  it("the mech's tech level drives Beefcake's SP scaling", () => {
    const mech = { chassisRef: 'no-such-chassis' }
    const chassis = { structurePoints: 20 }
    expect(mechMaxSPParts(mech, chassis, { abilities: ['Beefcake'], techLevel: 4 }).total).toBe(27)
  })
})

describe("Beefcake's four contributions each reach a real consumer", () => {
  // Beefcake was the record that motivated the whole model, and it is the one
  // most easily half-wired: two of its four contributions target the PILOT and
  // two target the PILOTED MECH, so a surface that forgets the piloting context
  // silently under-counts rather than failing.
  const BEEFCAKE = ['Beefcake']

  it('pilot Max HP +2', () => {
    expect(pilotMaxHPParts({ abilities: BEEFCAKE }).total).toBe(12)
  })

  it('pilot Inventory +4 is declared (consumed by pilotInventoryCapacity)', () => {
    expect(sumContributions(abilityContributions(BEEFCAKE, 'pilot', 'inventorySlots'))).toBe(4)
  })

  it('piloted mech Cargo +6', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    expect(mechMaxCargoParts(mech, { cargoCapacity: 6 }, { abilities: BEEFCAKE }).total).toBe(12)
  })

  it('piloted mech Max SP 3+X, and X is the MECH tech level not the pilot', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    const chassis = { structurePoints: 20 }
    expect(mechMaxSPParts(mech, chassis, { abilities: BEEFCAKE, techLevel: 1 }).total).toBe(24)
    expect(mechMaxSPParts(mech, chassis, { abilities: BEEFCAKE, techLevel: 6 }).total).toBe(29)
  })

  it('a mech with no piloting context gets NONE of it — the under-count to guard', () => {
    const mech = { chassisRef: 'no-such-chassis' }
    expect(mechMaxSPParts(mech, { structurePoints: 20 }).total).toBe(20)
    expect(mechMaxCargoParts(mech, { cargoCapacity: 6 }).total).toBe(6)
  })
})
