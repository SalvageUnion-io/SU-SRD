/**
 * Core Mechanic d20 band tests.
 *
 * Band boundaries per Core Book p.229-232 / Quick Ref 2.0:
 * 20 Nailed it · 11-19 Success · 6-10 Tough Choice · 2-5 Failure · 1 Cascade.
 * The d20 is injectable, so every test is deterministic.
 */

import { describe, expect, test } from 'bun:test'
import {
  CORE_ROLL_BANDS,
  coreRollBand,
  coreRollBandLabel,
  describePushOutcome,
  performCoreRoll,
} from '../coreMechanic'
import { performHeatCheck, performPush } from '../heatCheck'
import type { Roll } from '../types'

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

  test('every band carries its range metadata', () => {
    expect(CORE_ROLL_BANDS.success.range).toBe('11–19')
  })
})

describe('coreRollBandLabel', () => {
  // The titles are the Core Mechanic table's own, as Workshop Manual p.232
  // prints them: "Nailed it", lower-case "it", on that table.
  test('reads each band title from the Core Mechanic roll table', () => {
    expect(coreRollBandLabel(performCoreRoll(seqRoll(20)).band)).toBe('Nailed it')
    expect(coreRollBandLabel('success')).toBe('Success')
    expect(coreRollBandLabel('tough')).toBe('Tough Choice')
    expect(coreRollBandLabel('failure')).toBe('Failure')
    expect(coreRollBandLabel('cascade')).toBe('Cascade Failure')
  })

  test("each band's low face lands inside its own range", () => {
    for (const info of Object.values(CORE_ROLL_BANDS)) {
      expect(coreRollBand(info.low)).toBe(info.band)
    }
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
    const line = describePushOutcome(6, effect)
    expect(line).toContain('System Overload: One of your Mech')
    expect(line).toContain('Mark the System on the sheet.')
  })

  test('a 20 is Reactor Overdrive: the free action or Push, verbatim (p.235)', () => {
    const effect = performHeatCheck({ heat: 6, currentSP: 8, roll: seqRoll(3, 20) })
    expect(effect.result.outcome).toBe('overdrive')
    expect(describePushOutcome(6, effect)).toBe(
      '+2 Heat → 6. Heat Check 3 vs Heat 6 — OVERLOAD. Reactor Overload 20: Reactor ' +
        "Overdrive: Your Mech's reactor goes into overdrive. Your Mech can take any " +
        'additional action this turn or Push their next roll within 10 minutes for free.'
    )
  })

  test('a 1 prints the whole meltdown row, area damage included (p.235)', () => {
    const effect = performHeatCheck({ heat: 6, currentSP: 8, roll: seqRoll(3, 1) })
    const line = describePushOutcome(6, effect)
    expect(line).toContain('Reactor Overload 1: Reactor Overload: Your Mech')
    expect(line).toContain("SP damage equal to your Mech's Maximum Heat Capacity")
    expect(line).toEndWith('becomes Irradiated.')
  })
})
