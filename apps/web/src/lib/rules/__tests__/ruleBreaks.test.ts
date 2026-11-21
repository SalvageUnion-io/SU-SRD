/**
 * Rule breaks (SB-21, PT-05): a count over its cap is counted, an edit's new
 * or worse breaks are told apart from the ones it found, and a loadout the
 * book prints over its slots is no break.
 */

import { describe, expect, test } from 'bun:test'
import { mechRuleBreaks, ruleBreaksMade } from '../ruleBreaks'

const scrapper = (systems: string[], modules: string[] = []) => ({
  chassisRef: 'scrapper',
  systems,
  modules,
})

describe('mechRuleBreaks', () => {
  test('a loadout within its slots breaks nothing', () => {
    expect(mechRuleBreaks(scrapper(['chainsaw']))).toEqual([])
  })

  test('System Slots over the chassis count as one break, with both numbers', () => {
    const [found, ...rest] = mechRuleBreaks(
      scrapper(['mini-mortar', 'mini-mortar', 'mini-mortar', 'mini-mortar'])
    )
    expect(rest).toEqual([])
    expect(found?.stat).toBe('systemSlots')
    expect((found?.used ?? 0) > (found?.max ?? 0)).toBe(true)
  })

  test('an unknown chassis has no cap to break', () => {
    expect(
      mechRuleBreaks({ chassisRef: 'no-such-chassis', systems: ['chainsaw'], modules: [] })
    ).toEqual([])
  })
})

describe('ruleBreaksMade', () => {
  const at = (used: number) => [{ stat: 'systemSlots' as const, used, max: 12 }]

  test('a new break is told', () => {
    expect(ruleBreaksMade([], at(16))).toEqual(at(16))
  })

  test('a break made worse is told; one left alone or eased is not', () => {
    expect(ruleBreaksMade(at(13), at(16))).toEqual(at(16))
    expect(ruleBreaksMade(at(16), at(16))).toEqual([])
    expect(ruleBreaksMade(at(16), at(13))).toEqual([])
  })
})
