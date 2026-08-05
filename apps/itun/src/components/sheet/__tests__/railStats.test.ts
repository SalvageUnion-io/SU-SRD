/**
 * Unit tests for the rail vital readings.
 *
 * The Heat case is the point: SP and EP fall back to their MAXIMUM when the
 * record carries no stored value (an unrecorded mech is undamaged), but Heat is
 * inverted — an unrecorded mech is COOL, so it must fall back to 0. A fresh
 * mech is never Heat-at-capacity.
 */

import { describe, expect, test } from 'bun:test'
import { mechFixture } from '../../__tests__/fixtures'
import { mechRailItems } from '../railStats'

describe('mechRailItems', () => {
  test('a mech with no stored Heat reads 0/cap', () => {
    const mech = mechFixture({ id: 'm1', chassisRef: 'Mule' })
    expect(mech.currentHeat).toBeUndefined()
    const heat = mechRailItems(mech).find((s) => s.label === 'Heat')
    expect(heat?.max).toBeGreaterThan(0)
    expect(heat?.value).toBe(0)
  })

  test('SP and EP still fall back to full — an unrecorded mech is undamaged', () => {
    const mech = mechFixture({ id: 'm2', chassisRef: 'Mule' })
    const items = mechRailItems(mech)
    for (const label of ['SP', 'EP']) {
      const stat = items.find((s) => s.label === label)
      expect(stat?.value).toBe(stat?.max as number)
    }
  })

  test('a stored Heat above the cap is clamped, not shown over cap', () => {
    const mech = mechFixture({ id: 'm3', chassisRef: 'Mule', currentHeat: 999 })
    const heat = mechRailItems(mech).find((s) => s.label === 'Heat')
    expect(heat?.value).toBe(heat?.max as number)
  })
})
