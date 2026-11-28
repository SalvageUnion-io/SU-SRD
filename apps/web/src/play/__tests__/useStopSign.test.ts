/** Whoever showed the Stop Sign is told when someone else lifts it (r5 A8). */

import { describe, expect, test } from 'bun:test'
import { liftedForMe } from '../useStopSign'

describe('liftedForMe', () => {
  test('my sign, gone without my lift: someone else lifted it', () => {
    expect(liftedForMe(5, null, undefined)).toBe(true)
  })

  test('my own lift, a sign still up, or a sign that was never mine says nothing', () => {
    expect(liftedForMe(5, null, 5)).toBe(false)
    expect(liftedForMe(5, { shownAt: 5 }, undefined)).toBe(false)
    expect(liftedForMe(null, null, undefined)).toBe(false)
  })

  test('a lift of an earlier sign does not count for this one', () => {
    expect(liftedForMe(9, null, 5)).toBe(true)
  })
})
