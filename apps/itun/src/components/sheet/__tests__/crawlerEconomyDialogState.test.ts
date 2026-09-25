import { describe, expect, test } from 'bun:test'
import { exchangeStep } from '../../../lib/rules/crawlerEconomy'
import {
  INITIAL_UPKEEP_STATE,
  initialTradeState,
  tradeReducer,
  tradeStep,
  upkeepReducer,
} from '../crawlerEconomyDialogState'

describe('upkeepReducer', () => {
  test('a failed payment explains itself but leaves the dialog open', () => {
    const next = upkeepReducer(INITIAL_UPKEEP_STATE, { type: 'payFailed' })
    expect(next.done).toBe(false)
    expect(next.result).toContain('roll Deterioration')
  })

  test('paying finishes the dialog', () => {
    const next = upkeepReducer(INITIAL_UPKEEP_STATE, { type: 'paid', message: 'Paid 5 Scrap' })
    expect(next).toEqual({ result: 'Paid 5 Scrap', choosePrompt: false, done: true })
  })

  test('a Deterioration roll finishes the dialog and carries the Bay-pick prompt', () => {
    const next = upkeepReducer(INITIAL_UPKEEP_STATE, {
      type: 'deteriorated',
      message: 'Deterioration 7: a Bay of your choice…',
      choosePrompt: true,
    })
    expect(next).toEqual({
      result: 'Deterioration 7: a Bay of your choice…',
      choosePrompt: true,
      done: true,
    })
  })
})

describe('tradeReducer', () => {
  test('starts on T1 → T2 at one exchange step', () => {
    expect(initialTradeState()).toEqual({
      fromTl: 1,
      toTl: 2,
      count: exchangeStep(1, 2),
      convertNote: null,
      availability: null,
    })
  })

  test('changing either side re-seats the quantity on the new exchange step', () => {
    const fromChanged = tradeReducer(
      { ...initialTradeState(), count: 99 },
      { type: 'pickFrom', tl: 3 }
    )
    expect(fromChanged.fromTl).toBe(3)
    expect(fromChanged.count).toBe(exchangeStep(3, 2))

    const toChanged = tradeReducer(fromChanged, { type: 'pickTo', tl: 5 })
    expect(toChanged.toTl).toBe(5)
    expect(toChanged.count).toBe(exchangeStep(3, 5))
  })

  test('a same-level pair holds the quantity at 1', () => {
    const next = tradeReducer(initialTradeState(), { type: 'pickTo', tl: 1 })
    expect(next.count).toBe(1)
    expect(tradeStep(1, 1)).toBe(1)
  })

  test('notes and rolls do not disturb the trade being composed', () => {
    const composed = tradeReducer(initialTradeState(), { type: 'pickFrom', tl: 4 })
    const noted = tradeReducer(composed, { type: 'converted', note: 'Traded' })
    expect(noted).toEqual({ ...composed, convertNote: 'Traded' })
    const result = { roll: 12, availability: 'nothing' as const, sourceTl: 5 }
    const rolled = tradeReducer(noted, { type: 'rolled', result })
    expect(rolled).toEqual({ ...noted, availability: result })
  })
})
