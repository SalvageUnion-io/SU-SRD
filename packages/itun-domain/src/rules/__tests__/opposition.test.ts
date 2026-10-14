/**
 * The Opposition's rules (Core Book p.268): what an NPC tracks, when it is
 * down, and the Morale roll. Real reference data, so the table is the book's.
 */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isDown, rollMorale, trackOf } from '../opposition'

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
