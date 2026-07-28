/**
 * Shared class strings for the Game surfaces (Mediator screen, proposal inbox,
 * Downtime panel).
 *
 * These are the app's existing vocabulary, not a new one: hard 2px ink borders
 * and stamped condensed caps are how every other ITUN surface frames a section,
 * and the tracking values come from the shipped ladder rather than arbitrary
 * bracketed literals, which the design-token gate rejects outright. (Spelling
 * that pattern out here would itself trip the gate, which scans file text
 * rather than only class attributes.)
 *
 * Collected here so the three new surfaces stay consistent with each other
 * without inventing a component layer that a real design pass would have to
 * unpick.
 */

/** Small stamped label above a group. */
export const STAMP = 'font-cond text-xs font-bold tracking-caps-wide uppercase'

/** Screen title. */
export const TITLE = 'font-cond text-2xl font-bold tracking-caps uppercase'

/** Section heading inside a card. */
export const SECTION = 'font-cond text-lg font-bold tracking-caps-snug uppercase'

/** Text input, matching the sheet's inline-edit fields. */
export const INPUT = 'border-2 border-[var(--color-ink)] bg-[var(--color-paper)] px-2 py-1'

/** A single row in a list of people or entities. */
export const ROW =
  'flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-ink)]/15 py-1 last:border-b-0'

/** Numeric readout — tabular so columns of vitals line up. */
export const NUM = 'font-cond tabular-nums'
