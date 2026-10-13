/**
 * Core Mechanic d20.
 *
 * Salvage Union Core Book p.232 / Quick Ref 2.0 p.1 — the game's single
 * resolution roll. Roll a d20 and read the band:
 *
 *   20    → Nailed it       (outstanding success + a bonus of your choice)
 *   11-19 → Success         (goal achieved without compromise)
 *   6-10  → Tough Choice    (success at a cost — Setback attached)
 *   2-5   → Failure         (failed; Setback of the Mediator's choice)
 *   1     → Cascade Failure (severe consequence of the Mediator's choice)
 *
 * The app's value is the band text + Push bookkeeping, not the RNG: rolling
 * is component-state only (never persisted), while a mech Push routes the +2
 * Heat and Heat Check through the store per ADR-007 (mechanical bookkeeping
 * auto-applies; the player marks any destroyed System/Module by hand).
 *
 * This module is PURE: no React, no store, no real randomness — the d20 is
 * injected via the shared `Roll` type so tests are deterministic. The reads of
 * the catalog are {@link coreRollBandLabel} and {@link describeOverloadOutcome}:
 * a band's title and a Reactor Overload row are the roll tables' own text, so
 * they need `roll-tables` preloaded.
 */

import { SalvageUnionReference } from '../index'
import { plainTraitText } from '../traitText'
import { resultForTable } from '../utils/resultForTable'
import type { HeatCheckEffect, ReactorOverloadOutcome, Roll } from './types'

export type CoreRollBand = 'nailed' | 'success' | 'tough' | 'failure' | 'cascade'

export type CoreRollBandInfo = {
  band: CoreRollBand
  /**
   * The band's lowest face: where it starts on the Core Mechanic table. The
   * title is read from the table there by {@link coreRollBandLabel}.
   */
  low: number
  /** The d20 range, e.g. '11–19'. */
  range: string
  /** One-line rules summary (Quick Ref 2.0 wording, condensed). */
  summary: string
}

/** Band metadata in table order (20 → 1), for readouts and legends. */
export const CORE_ROLL_BANDS: Record<CoreRollBand, CoreRollBandInfo> = {
  nailed: {
    band: 'nailed',
    low: 20,
    range: '20',
    summary: 'An outstanding success — take an additional bonus of your choice.',
  },
  success: {
    band: 'success',
    low: 11,
    range: '11–19',
    summary: 'You achieve your goal without any compromises.',
  },
  tough: {
    band: 'tough',
    low: 6,
    range: '6–10',
    summary: 'You succeed, but the Mediator gives you a Tough Choice with a Setback attached.',
  },
  failure: {
    band: 'failure',
    low: 2,
    range: '2–5',
    summary: "You fail, and face a Setback of the Mediator's choice.",
  },
  cascade: {
    band: 'cascade',
    low: 1,
    range: '1',
    summary: 'Something has gone terribly wrong — you suffer a severe consequence.',
  },
}

/**
 * A band's title, as the Core Mechanic roll table prints it (Workshop Manual
 * p.232: "Nailed it", "Success", "Tough Choice", "Failure", "Cascade Failure").
 * Read from the table's data, so the readout and the table cannot disagree.
 *
 * Preload requirement: `roll-tables`.
 */
export function coreRollBandLabel(band: CoreRollBand): string {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')?.table
  const label = resultForTable(table, CORE_ROLL_BANDS[band].low).result.label
  if (label === undefined) throw new Error(`The Core Mechanic table has no label for ${band}`)
  return label
}

/**
 * Maps a Core Mechanic d20 roll to its band (p.232). Rolls are clamped
 * into [1, 20] defensively — modifiers never move a roll off the table.
 */
export function coreRollBand(roll: number): CoreRollBand {
  if (roll <= 1) return 'cascade'
  if (roll <= 5) return 'failure'
  if (roll <= 10) return 'tough'
  if (roll <= 19) return 'success'
  return 'nailed'
}

export type CoreRollResult = {
  /** The d20 face rolled. */
  roll: number
  band: CoreRollBand
}

/** Rolls the Core Mechanic d20 via the injected roller and reads the band. */
export function performCoreRoll(roll: Roll): CoreRollResult {
  const value = roll(20)
  return { roll: value, band: coreRollBand(value) }
}

/**
 * What the app did, or leaves to the player, for each Reactor Overload band:
 * appended after the table's own row so the readout says what is already on
 * the sheet (ADR-007). The row text alone covers the rest: a Meltdown's
 * destruction is confirmed by its caller, and the Overdrive's free action or
 * Push is the player's to take.
 */
const OVERLOAD_BOOKKEEPING: Record<ReactorOverloadOutcome, string> = {
  meltdown: '',
  'system-destroyed': 'Mark the System on the sheet.',
  'module-destroyed': 'Mark the Module on the sheet.',
  overheat: 'Shutdown, Vulnerable and the SP damage are applied.',
  overdrive: '',
}

/**
 * The Heat Check outcome sentence — everything after the `… — ` in a Heat Check
 * readout. The Dashboard's `describeHeatCheck` and this module's
 * `describePushOutcome` differ only in the head they prefix, so the tail lives
 * here and the FAB, the sheet body and the Dashboard band can never drift
 * apart.
 *
 * An overload prints the rolled row of the Reactor Overload table (Core Book
 * p.235) — its title and text, verbatim — then the app's bookkeeping, so the
 * readout and the book cannot disagree.
 *
 * Preload requirement: `roll-tables`.
 */
export function describeOverloadOutcome(result: HeatCheckEffect['result']): string {
  if (!result.overloaded) return 'passed (no overload).'

  const table = SalvageUnionReference.RollTables.getByName('Reactor Overload')?.table
  const row = resultForTable(table, result.overloadRoll ?? 0)
  const text = row.success ? plainTraitText(row.result.value).trim() : ''
  // A row that stops without a full stop still reads as a sentence before the
  // bookkeeping that follows it.
  const sentence = text === '' || /[.!?]$/.test(text) ? text : `${text}.`
  const rowText = row.result.label && sentence ? `${row.result.label}: ${sentence}` : sentence
  const bookkeeping = result.outcome ? OVERLOAD_BOOKKEEPING[result.outcome] : ''
  const outcome = [rowText, bookkeeping].filter(Boolean).join(' ')
  return `Overload. Reactor Overload ${result.overloadRoll}: ${outcome}`
}

/**
 * One-line readout for a mech Push's Heat Check outcome, surfaced next to the
 * re-rolled d20 in the quick-roll log. Mirrors HeatCheckControl's wording so
 * the FAB and the sheet-body readout never disagree.
 */
export function describePushOutcome(nextHeat: number, effect: HeatCheckEffect): string {
  const r = effect.result
  const head = `+2 Heat → ${nextHeat}. Heat Check ${r.heatCheckRoll} vs Heat ${r.heatAtCheck}`
  return `${head} — ${describeOverloadOutcome(r)}`
}
