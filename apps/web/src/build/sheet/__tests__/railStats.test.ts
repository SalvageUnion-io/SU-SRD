/**
 * Unit tests for the rail vital readings.
 *
 * The Heat case is the point: SP and EP fall back to their MAXIMUM when the
 * record carries no stored value (an unrecorded mech is undamaged), but Heat is
 * inverted — an unrecorded mech is COOL, so it must fall back to 0. A fresh
 * mech is never Heat-at-capacity.
 */

import { describe, expect, test } from 'bun:test'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { mechRailItems, pilotRailItems } from '../railStats.model'

describe('mechRailItems', () => {
  test('a mech with no stored Heat reads 0/cap', () => {
    const mech = mechFixture({ id: 'm1', chassisRef: 'mule' })
    expect(mech.currentHeat).toBeUndefined()
    const heat = mechRailItems(mech, undefined).find((s) => s.label === 'Heat')
    expect(heat?.max).toBeGreaterThan(0)
    expect(heat?.value).toBe(0)
  })

  test('SP and EP still fall back to full — an unrecorded mech is undamaged', () => {
    const mech = mechFixture({ id: 'm2', chassisRef: 'mule' })
    const items = mechRailItems(mech, undefined)
    for (const label of ['SP', 'EP']) {
      const stat = items.find((s) => s.label === label)
      expect(stat?.value).toBe(stat?.max as number)
    }
  })

  test('a stored Heat above the cap is clamped, not shown over cap', () => {
    const mech = mechFixture({ id: 'm3', chassisRef: 'mule', currentHeat: 999 })
    const heat = mechRailItems(mech, undefined).find((s) => s.label === 'Heat')
    expect(heat?.value).toBe(heat?.max as number)
  })
})

describe('pilotRailItems', () => {
  test('a pilot aboard a Tech 3 crawler reads its Stat Training max, as the sheet does', () => {
    const pilot = pilotFixture({ id: 'p1' })
    const hp = (crawler: { techLevel: number } | null) =>
      pilotRailItems(pilot, crawler).find((s) => s.label === 'HP')?.max ?? 0
    expect(hp({ techLevel: 3 }) - hp(null)).toBe(4)
  })
})
