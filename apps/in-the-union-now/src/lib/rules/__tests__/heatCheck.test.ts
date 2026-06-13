/**
 * Heat Check / Reactor Overload rule tests (Slice C, #199).
 *
 * The d20 is INJECTABLE via the `roll` param, so every test is deterministic —
 * no real randomness. We build a `seqRoll` helper that returns a scripted
 * sequence of rolls (first call = Heat Check d20, second = Reactor Overload d20).
 */

import { describe, expect, test } from 'bun:test'

import { clampHeat, performHeatCheck, performPush, reactorOverloadOutcome } from '../heatCheck'
import type { Roll } from '../heatCheck'

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

const fixedNow = () => new Date('2026-06-03T00:00:00.000Z')

// ---------------------------------------------------------------------------
// clampHeat — rule 1: heat cannot exceed Heat Cap
// ---------------------------------------------------------------------------

describe('clampHeat', () => {
  test('clamps heat at cap', () => {
    expect(clampHeat(12, 8)).toBe(8)
  })

  test('leaves heat below cap untouched', () => {
    expect(clampHeat(5, 8)).toBe(5)
  })

  test('clamps negative heat to 0', () => {
    expect(clampHeat(-3, 8)).toBe(0)
  })

  test('treats negative cap as 0', () => {
    expect(clampHeat(5, -2)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// reactorOverloadOutcome — table band mapping (p.234-235)
// ---------------------------------------------------------------------------

describe('reactorOverloadOutcome', () => {
  test('1 → meltdown', () => {
    expect(reactorOverloadOutcome(1)).toBe('meltdown')
  })

  test('2-5 → system-destroyed', () => {
    expect(reactorOverloadOutcome(2)).toBe('system-destroyed')
    expect(reactorOverloadOutcome(5)).toBe('system-destroyed')
  })

  test('6-10 → module-destroyed', () => {
    expect(reactorOverloadOutcome(6)).toBe('module-destroyed')
    expect(reactorOverloadOutcome(10)).toBe('module-destroyed')
  })

  test('11-19 → overheat', () => {
    expect(reactorOverloadOutcome(11)).toBe('overheat')
    expect(reactorOverloadOutcome(19)).toBe('overheat')
  })

  test('20 → safe', () => {
    expect(reactorOverloadOutcome(20)).toBe('safe')
  })
})

// ---------------------------------------------------------------------------
// performHeatCheck — rule 2
// ---------------------------------------------------------------------------

describe('performHeatCheck', () => {
  test('roll > heat → no overload', () => {
    // heat 5, roll 12 → 12 > 5 → safe pass
    const effect = performHeatCheck({ heat: 5, currentSP: 10, roll: seqRoll(12), now: fixedNow })
    expect(effect.result.overloaded).toBe(false)
    expect(effect.result.heatCheckRoll).toBe(12)
    expect(effect.result.outcome).toBeUndefined()
    expect(effect.nextSP).toBe(10)
    expect(effect.shutdown).toBe(false)
    expect(effect.destroyed).toBe(false)
  })

  test('roll <= heat → overloads', () => {
    // heat 5, roll 5 → 5 <= 5 → overload; overload roll 20 → safe band
    const effect = performHeatCheck({ heat: 5, currentSP: 10, roll: seqRoll(5, 20), now: fixedNow })
    expect(effect.result.overloaded).toBe(true)
    expect(effect.result.overloadRoll).toBe(20)
    expect(effect.result.outcome).toBe('safe')
  })

  test('natural 20 always passes even at high heat (Heat Cap can exceed 20)', () => {
    // heat 20, roll 20 → a natural 20 is always a success, never an overload.
    const effect = performHeatCheck({ heat: 20, currentSP: 10, roll: seqRoll(20), now: fixedNow })
    expect(effect.result.overloaded).toBe(false)
    expect(effect.result.heatCheckRoll).toBe(20)
    expect(effect.result.outcome).toBeUndefined()
    expect(effect.nextSP).toBe(10)
    expect(effect.shutdown).toBe(false)
    expect(effect.destroyed).toBe(false)
  })

  test('overload 11-19 applies SP damage = heat, sets shutdown + vulnerable', () => {
    // heat 6, check roll 3 (<=6 overload), overload roll 15 → overheat
    const effect = performHeatCheck({ heat: 6, currentSP: 10, roll: seqRoll(3, 15), now: fixedNow })
    expect(effect.result.outcome).toBe('overheat')
    expect(effect.nextSP).toBe(4) // 10 - 6
    expect(effect.shutdown).toBe(true)
    expect(effect.vulnerable).toBe(true)
    expect(effect.destroyed).toBe(false)
    expect(effect.requiresPlayerChoice).toBe(false)
  })

  test('overheat SP damage clamps at 0', () => {
    // heat 9, SP 4, overheat → 4 - 9 = -5 → clamp 0
    const effect = performHeatCheck({ heat: 9, currentSP: 4, roll: seqRoll(1, 15), now: fixedNow })
    expect(effect.result.outcome).toBe('overheat')
    expect(effect.nextSP).toBe(0)
  })

  test('overload roll 1 → meltdown, mech destroyed', () => {
    const effect = performHeatCheck({ heat: 8, currentSP: 10, roll: seqRoll(2, 1), now: fixedNow })
    expect(effect.result.outcome).toBe('meltdown')
    expect(effect.destroyed).toBe(true)
    expect(effect.nextSP).toBe(10) // no SP damage on meltdown
    expect(effect.shutdown).toBe(false)
  })

  test('overload 2-5 → requires player choice (system), no auto SP/flags', () => {
    const effect = performHeatCheck({ heat: 8, currentSP: 10, roll: seqRoll(2, 3), now: fixedNow })
    expect(effect.result.outcome).toBe('system-destroyed')
    expect(effect.requiresPlayerChoice).toBe(true)
    expect(effect.nextSP).toBe(10)
    expect(effect.shutdown).toBe(false)
    expect(effect.destroyed).toBe(false)
  })

  test('overload 6-10 → requires player choice (module)', () => {
    const effect = performHeatCheck({ heat: 8, currentSP: 10, roll: seqRoll(2, 8), now: fixedNow })
    expect(effect.result.outcome).toBe('module-destroyed')
    expect(effect.requiresPlayerChoice).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// performPush — rule 3: +2 heat then a Heat Check
// ---------------------------------------------------------------------------

describe('performPush', () => {
  test('adds 2 heat then performs a Heat Check', () => {
    // heat 3 → +2 = 5, cap 8. Check roll 12 > 5 → no overload.
    const { nextHeat, effect } = performPush({
      heat: 3,
      heatCap: 8,
      currentSP: 10,
      roll: seqRoll(12),
      now: fixedNow,
    })
    expect(nextHeat).toBe(5)
    expect(effect.result.heatAtCheck).toBe(5)
    expect(effect.result.overloaded).toBe(false)
  })

  test('clamps heat to cap before checking', () => {
    // heat 7 → +2 = 9, cap 8 → clamp to 8. Check roll 4 <= 8 → overload.
    const { nextHeat, effect } = performPush({
      heat: 7,
      heatCap: 8,
      currentSP: 10,
      roll: seqRoll(4, 15),
      now: fixedNow,
    })
    expect(nextHeat).toBe(8)
    expect(effect.result.heatAtCheck).toBe(8)
    expect(effect.result.overloaded).toBe(true)
    expect(effect.result.outcome).toBe('overheat')
  })
})
