/**
 * The Opposition's rules (Core Book p.268): what an NPC tracks, when it is
 * down, and the Morale roll. Real reference data, so the table is the book's.
 */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  groupMoraleDue,
  importantTrackOf,
  isDown,
  isImportantRoll,
  moraleDue,
  npcHeatCheck,
  rollMorale,
  rollNpcCritical,
  rollReaction,
  trackOf,
} from '../opposition'

const NOW = '2026-10-09T12:00:00.000Z'

describe('trackOf', () => {
  test('a vehicle tracks SP', () => {
    const vehicle = SalvageUnionReference.Vehicles.all()[0]
    if (vehicle === undefined) throw new Error('no vehicles in the reference')
    expect(trackOf(vehicle).statKind).toBe('sp')
  })

  test('a squad tracks HP', () => {
    const squad = SalvageUnionReference.Squads.all()[0]
    if (squad === undefined) throw new Error('no squads in the reference')
    const track = trackOf(squad)
    expect(track.statKind).toBe('hp')
    expect(track.maxHp).toBeGreaterThan(0)
  })
})

describe('isDown', () => {
  test('at 0 an NPC is down', () => {
    expect(isDown(0, 6)).toBe(true)
    expect(isDown(1, 6)).toBe(false)
  })

  test('a row with no tracked maximum is never down', () => {
    expect(isDown(0, 0)).toBe(false)
  })
})

describe('rollMorale', () => {
  test('Morale is a d20 on the reference table (p.268)', () => {
    expect(rollMorale(() => 7, NOW)).toMatchObject({
      table: 'morale',
      roll: 7,
      label: 'Fighting Retreat',
      rolledAt: NOW,
    })
    expect(rollMorale(() => 20, NOW)?.label).toBe('Fight to the Death')
  })
})

describe('rollReaction', () => {
  test('Reaction is a d20 on the Reaction Roll table (p.267-268)', () => {
    expect(rollReaction(() => 4, NOW)).toMatchObject({
      table: 'reaction',
      roll: 4,
      label: 'Hostile',
    })
  })
})

describe('Morale due (Core Book p.268)', () => {
  const mech = { refSchema: 'chassis', currentHp: 6, maxHp: 12, lastRoll: null }
  const rolled = (table: 'morale' | 'reaction' | 'retreat') => ({ table })

  test('a Mech or Creature at half or less, standing, with no Morale roll since', () => {
    expect(moraleDue(mech)).toBe(true)
    expect(moraleDue({ ...mech, refSchema: 'creatures', currentHp: 1 })).toBe(true)
    expect(moraleDue({ ...mech, currentHp: 7 })).toBe(false)
    expect(moraleDue({ ...mech, currentHp: 0 })).toBe(false)
    expect(moraleDue({ ...mech, lastRoll: rolled('morale') })).toBe(false)
    expect(moraleDue({ ...mech, lastRoll: rolled('retreat') })).toBe(false)
    expect(moraleDue({ ...mech, lastRoll: rolled('reaction') })).toBe(true)
  })

  test('an NPC checks with its group, not alone', () => {
    expect(moraleDue({ ...mech, refSchema: 'npcs' })).toBe(false)
    expect(moraleDue({ ...mech, refSchema: null })).toBe(false)
  })

  test('a group at half or more down, someone standing, unchecked', () => {
    const up = { refSchema: 'npcs', currentHp: 3, maxHp: 3, lastRoll: null }
    const down = { ...up, currentHp: 0 }
    expect(groupMoraleDue([down, up])).toBe(true)
    expect(groupMoraleDue([down, up, up])).toBe(false)
    expect(groupMoraleDue([down, down])).toBe(false)
    expect(groupMoraleDue([down, { ...up, lastRoll: rolled('morale') }])).toBe(false)
  })
})

/** A die that rolls these faces in turn. */
const faces =
  (...rolls: number[]) =>
  () =>
    rolls.shift() ?? 1

describe('importantTrackOf (Workshop Manual p.255)', () => {
  test('a mech tracks its chassis EP and Heat, and rolls Critical Damage at 0', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (mule === undefined) throw new Error('no Mule in the reference')
    expect(importantTrackOf('chassis', mule, 'sp')).toEqual({
      reactor: { maxEp: mule.energyPoints, heatCap: mule.heatCapacity },
      critical: 'critical-damage',
    })
  })

  test('an HP NPC has no reactor and rolls Critical Injury', () => {
    const npc = SalvageUnionReference.NPCs.all()[0]
    if (npc === undefined) throw new Error('no NPCs in the reference')
    expect(importantTrackOf('npcs', npc, 'hp')).toEqual({
      reactor: null,
      critical: 'critical-injury',
    })
  })

  test('Bio-Titans and Meld keep their own rules at 0', () => {
    expect(importantTrackOf('bio-titans', null, 'sp')).toBeNull()
    expect(importantTrackOf('meld', null, 'hp')).toBeNull()
  })
})

describe('rollNpcCritical', () => {
  test("quotes the book's row, and changes nothing below 20", () => {
    const rolled = rollNpcCritical('critical-damage', () => 12, NOW)
    expect(rolled?.result).toMatchObject({
      table: 'critical-damage',
      roll: 12,
      label: 'Core Damage',
    })
    expect(rolled?.nextHp).toBeNull()
    expect(isImportantRoll(rolled?.result)).toBe(true)
  })

  test('a 20 is a Miraculous Survival at 1', () => {
    const rolled = rollNpcCritical('critical-injury', () => 20, NOW)
    expect(rolled?.result.label).toBe('Miraculous Survival')
    expect(rolled?.nextHp).toBe(1)
  })
})

describe('npcHeatCheck (Core Book p.234)', () => {
  test('a roll over its Heat passes and changes nothing', () => {
    expect(npcHeatCheck(4, 10, faces(9), NOW)).toEqual({
      roll: 9,
      heat: 4,
      overload: null,
      nextSp: 10,
    })
  })

  test('an overheat reads the Reactor Overload row and takes its Heat in SP', () => {
    const checked = npcHeatCheck(6, 10, faces(3, 15), NOW)
    expect(checked?.roll).toBe(3)
    expect(checked?.overload?.roll).toBe(15)
    expect(checked?.overload?.value).toBeTruthy()
    expect(checked?.nextSp).toBe(4)
  })

  test('a meltdown changes no number: the Mediator narrates it', () => {
    const checked = npcHeatCheck(6, 10, faces(3, 1), NOW)
    expect(checked?.overload?.label).toBe('Reactor Overload')
    expect(checked?.nextSp).toBe(10)
  })
})

describe('isImportantRoll', () => {
  test('a Morale roll is not one', () => {
    expect(isImportantRoll({ table: 'morale', roll: 4, value: 'x', rolledAt: NOW })).toBe(false)
    expect(isImportantRoll(null)).toBe(false)
  })
})
