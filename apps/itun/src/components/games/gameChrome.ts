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

/**
 * The page shell every Game surface sits on — the Roster's, verbatim.
 *
 * The Game screens used to be a centred `max-w-6xl` column while the Roster ran
 * the full width of the window. Both are the same kind of surface (three
 * ontology columns of entity rows), so at any desktop width the crew view read
 * as a narrower, punier version of the home page — and its three columns went
 * cramped exactly where the Roster's had room. Same shape, same shell.
 */
export const PAGE = 'min-h-screen bg-wk-bg px-4 py-5 sm:px-8 sm:py-10 lg:px-12 flex flex-col gap-6'

/**
 * A panel's TITLE, as it sits in the card's header band.
 *
 * The same rule the entity card and the entity row use for a title: paper-white
 * text directly on the tone, condensed, bold, uppercase, tight caps tracking.
 * The Game panels used to state their names as a small `STAMP` INSIDE an
 * untoned slab, which left the game surface speaking two dialects — banded,
 * toned rows above; grey-labelled boxes below.
 */
export const PANEL_TITLE =
  'font-cond text-base font-bold uppercase leading-none tracking-caps-tight text-paper'

/**
 * The tone every Game-surface panel wears — the `game` ontology, the same blue
 * a Game row carries in the lobby. `Card` darkens it to the deep fill for the
 * band, which is what makes the paper-white title legible on it.
 */
export const PANEL_TONE = 'bg-sheet-game'

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
