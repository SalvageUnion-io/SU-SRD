import type { ReactNode } from 'react'
import type { StatItem } from '../containers/statsBarTypes'
import type { StatBorderState } from './Stat'

/**
 * A slab's count when it is a VALUE (`SLOTS | 3/6`, `INTACT | 10/10`): a
 * label-first horizontal `Stat` chip (ruleset §3.7, EDL E9), never trailing
 * text ("3/6 slots"). A word ("Choose 1", "Tree") stays a `ReactNode`.
 */
export type SlabCount = {
  /** The chip's label: what is counted ('Slots', 'Intact'). */
  label: string
  /** The reading; with `max` it reads `value/max`. */
  value: number | string
  max?: number
  /** The chip's border state: `critical` when the reading is over its cap. */
  state?: StatBorderState
  /** A muted word after the chip ("as printed"). */
  note?: ReactNode
  /** The chip's hover text (where an "as printed" count is printed). */
  title?: string
}

/** A fact a header's summary must not repeat: a child's chip, or its parent header's count. */
export type SummaryFact = { label: string; value: number | string; max?: number }

/** A header shows at most two summary chips, totals and caps of what it holds (C3). */
export const SUMMARY_BUDGET = 2

const reading = (fact: SummaryFact) =>
  `${fact.label.trim().toLowerCase()}|${fact.value}${fact.max !== undefined ? `/${fact.max}` : ''}`

/**
 * A header's summary (`chips-and-actions.md` C10, C3): its counts, in order,
 * less any that repeat a fact one of its children shows or its parent's own
 * summary states, and at most `SUMMARY_BUDGET` of them.
 */
export function slabSummary(
  counts: readonly SlabCount[],
  context: { children?: readonly SummaryFact[]; parent?: readonly SummaryFact[] } = {}
): SlabCount[] {
  const said = new Set([...(context.children ?? []), ...(context.parent ?? [])].map(reading))
  return counts.filter((count) => !said.has(reading(count))).slice(0, SUMMARY_BUDGET)
}

/** A summary's counts as `Chips` facts: measures (totals and caps), in order. */
export function summaryFacts(counts: readonly SlabCount[]): StatItem[] {
  return counts.map((count) => ({
    key: `summary-${count.label}`,
    label: count.label,
    value: count.value,
    group: 'capacity',
    ...(count.max !== undefined ? { outOfMax: count.max } : {}),
    ...(count.state ? { state: count.state } : {}),
  }))
}
