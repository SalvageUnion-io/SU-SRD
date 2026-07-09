/**
 * Core Mechanic d20 band tests (design review R-6/U-3).
 *
 * Band boundaries per Core Book p.229-232 / Quick Ref 2.0:
 * 20 Nailed It · 11-19 Success · 6-10 Tough Choice · 2-5 Failure · 1 Cascade.
 * The d20 is injectable, so every test is deterministic.
 */

import { describe, expect, test } from 'bun:test'

import {
  CORE_ROLL_BANDS,
  coreRollBand,
  describePushOutcome,
  performCoreRoll,
} from './coreMechanic.js'
import { performHeatCheck, performPush } from './heatCheck.js'
import type { Roll } from './types.js'

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

describe('coreRollBand', () => {
  test('20 is Nailed It', () => {
    expect(coreRollBand(20)).toBe('nailed')
  })

  test('11-19 is Success (both boundaries)', () => {
    expect(coreRollBand(11)).toBe('success')
    expect(coreRollBand(15)).toBe('success')
    expect(coreRollBand(19)).toBe('success')
  })

  test('6-10 is Tough Choice (both boundaries)', () => {
    expect(coreRollBand(6)).toBe('tough')
    expect(coreRollBand(10)).toBe('tough')
  })

  test('2-5 is Failure (both boundaries)', () => {
    expect(coreRollBand(2)).toBe('failure')
    expect(coreRollBand(5)).toBe('failure')
  })

  test('1 is Cascade Failure', () => {
    expect(coreRollBand(1)).toBe('cascade')
  })

  test('out-of-range rolls clamp onto the table ends', () => {
    expect(coreRollBand(0)).toBe('cascade')
    expect(coreRollBand(25)).toBe('nailed')
  })
})

describe('performCoreRoll', () => {
  test('rolls a d20 and reads the band', () => {
    const result = performCoreRoll(seqRoll(7))
    expect(result.roll).toBe(7)
    expect(result.band).toBe('tough')
  })

  test('every band carries printed label + range metadata', () => {
    expect(CORE_ROLL_BANDS[performCoreRoll(seqRoll(20)).band].label).toBe('Nailed It')
    expect(CORE_ROLL_BANDS.success.range).toBe('11–19')
    expect(CORE_ROLL_BANDS.cascade.label).toBe('Cascade Failure')
  })
})

describe('describePushOutcome', () => {
  test('passed check reads as no overload', () => {
    const { nextHeat, effect } = performPush({
      heat: 3,
      heatCap: 10,
      currentSP: 8,
      roll: seqRoll(18),
    })
    expect(nextHeat).toBe(5)
    expect(describePushOutcome(nextHeat, effect)).toBe(
      '+2 Heat → 5. Heat Check 18 vs Heat 5 — passed (no overload).'
    )
  })

  test('overheat band surfaces the auto-applied bookkeeping', () => {
    // Heat Check d20 = 4 (≤ heat 6 → overload), Reactor Overload d20 = 12.
    const { nextHeat, effect } = performPush({
      heat: 4,
      heatCap: 10,
      currentSP: 8,
      roll: seqRoll(4, 12),
    })
    const line = describePushOutcome(nextHeat, effect)
    expect(line).toContain('OVERLOAD')
    expect(line).toContain('Reactor Overload 12')
    expect(line).toContain('Reactor Overheat')
  })

  test('system-destroyed band prompts the player choice (ADR-007)', () => {
    const effect = performHeatCheck({ heat: 6, currentSP: 8, roll: seqRoll(3, 4) })
    expect(describePushOutcome(6, effect)).toContain('mark one on the sheet')
  })
})
