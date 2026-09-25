/**
 * The state machines behind `CrawlerEconomyControl`'s Upkeep and Trading Bay
 * dialogs, as pure reducers (audit AP-16).
 *
 * Each dialog used to hold its state as a row of independent `useState`s —
 * three for Upkeep, five for the Trading Bay — and every transition had to set
 * the right subset of them by hand. The pairs that must move together are the
 * easy ones to get wrong: picking a new "from" Tech Level has to re-seat the
 * quantity on the new exchange step, or the stepper offers an amount the Trading
 * Bay can never convert; a Deterioration roll has to finish the dialog AND say
 * whether the player now owes a Bay pick. As reducers each transition is one
 * named action, and it can be tested without rendering a modal.
 *
 * Only UI state lives here. The writes themselves — and the rules that compute
 * what to write — stay in the dialogs and `lib/rules/crawlerEconomy.ts`.
 */

import type { TradingRollResult } from '../../lib/rules/crawlerEconomy'
import { exchangeStep } from '../../lib/rules/crawlerEconomy'

// ---------------------------------------------------------------------------
// Pay Upkeep
// ---------------------------------------------------------------------------

export type UpkeepState = {
  /** The last outcome, announced as a status line. */
  result: string | null
  /** The Deterioration roll landed on 6-10: the PLAYER picks the damaged Bay. */
  choosePrompt: boolean
  /** A roll or payment has landed; the dialog only offers Done. */
  done: boolean
}

export type UpkeepAction =
  /** The pool emptied between opening the dialog and paying. Not terminal. */
  | { type: 'payFailed' }
  | { type: 'paid'; message: string }
  | { type: 'deteriorated'; message: string; choosePrompt: boolean }

export const INITIAL_UPKEEP_STATE: UpkeepState = { result: null, choosePrompt: false, done: false }

export function upkeepReducer(state: UpkeepState, action: UpkeepAction): UpkeepState {
  switch (action.type) {
    case 'payFailed':
      return {
        ...state,
        result: 'The pool can no longer cover Upkeep — roll Deterioration instead.',
      }
    case 'paid':
      return { ...state, result: action.message, done: true }
    case 'deteriorated':
      return { result: action.message, choosePrompt: action.choosePrompt, done: true }
  }
}

// ---------------------------------------------------------------------------
// Trading Bay
// ---------------------------------------------------------------------------

export type TradeState = {
  fromTl: number
  toTl: number
  /** How many `fromTl` scrap to trade — always a multiple of the exchange step. */
  count: number
  /** The last exchange's outcome. */
  convertNote: string | null
  /** The last availability roll (informational — buying stays a table call). */
  availability: TradingRollResult | null
}

export type TradeAction =
  | { type: 'pickFrom'; tl: number }
  | { type: 'pickTo'; tl: number }
  | { type: 'setCount'; count: number }
  | { type: 'converted'; note: string }
  | { type: 'rolled'; result: TradingRollResult }

/**
 * The exchange step for a pair — the stepper's increment, and the quantity the
 * dialog re-seats on whenever the pair changes, so the preview always shows the
 * smallest trade the Bay will actually make. A same-level pair is not a trade
 * at all, and holds at 1.
 */
export function tradeStep(fromTl: number, toTl: number): number {
  return fromTl === toTl ? 1 : exchangeStep(fromTl, toTl)
}

export function initialTradeState(): TradeState {
  return { fromTl: 1, toTl: 2, count: tradeStep(1, 2), convertNote: null, availability: null }
}

export function tradeReducer(state: TradeState, action: TradeAction): TradeState {
  switch (action.type) {
    case 'pickFrom':
      return { ...state, fromTl: action.tl, count: tradeStep(action.tl, state.toTl) }
    case 'pickTo':
      return { ...state, toTl: action.tl, count: tradeStep(state.fromTl, action.tl) }
    case 'setCount':
      return { ...state, count: action.count }
    case 'converted':
      return { ...state, convertNote: action.note }
    case 'rolled':
      return { ...state, availability: action.result }
  }
}
