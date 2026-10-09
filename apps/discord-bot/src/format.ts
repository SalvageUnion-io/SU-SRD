/**
 * Pure shaping helpers shared by the bot's container builders — no Discord
 * objects, so everything here is unit-testable.
 */

/**
 * Attribution carried by every roll surface. Rolls are powered by
 * @randsum/roller, and that credit is not optional — it rides on its own
 * subtext line, separate from the "recorded to a Game" signal so that a real,
 * personal game fact is never buried inside licensing boilerplate.
 */
export const ROLL_ATTRIBUTION = 'Salvage Union Reference · Powered by Randsum.dev'

/**
 * Neutral SU rust accent for replies without pass/fail semantics.
 *
 * `--color-rust: rgb(168, 82, 34)` from
 * `packages/component-lib/src/styles/theme.css`, annotated there as "THE single
 * action color". Same lockstep rule as {@link ROLL_COLORS}.
 */
export const NEUTRAL_ACCENT = 0xa85222

/**
 * Single source for the Core Mechanic roll-outcome accents. These mirror the
 * canon `--color-roll-*` ramp in
 * `packages/component-lib/src/styles/theme.css` — the tokens are the authority,
 * and each value here is the same rgb() converted to the 0xRRGGBB integer a
 * container accent needs. Keep in lockstep with theme.css; do not introduce
 * off-canon hues.
 */
export const ROLL_COLORS = {
  /** 20 · Nailed It — from `--color-roll-nailed: rgb(75, 134, 160)` (#4b86a0). */
  nailed: 0x4b86a0,
  /** 11–19 · Success — from `--color-roll-success: rgb(111, 138, 74)` (#6f8a4a). */
  success: 0x6f8a4a,
  /** 6–10 · Tough Choice — from `--color-roll-tough: rgb(193, 154, 62)` (#c19a3e). */
  tough: 0xc19a3e,
  /** 2–5 · Failure — from `--color-roll-failure: rgb(192, 122, 47)` (#c07a2f). */
  failure: 0xc07a2f,
  /** 1 · Cascade Failure — from `--color-roll-cascade: rgb(176, 67, 43)` (#b0432b). */
  cascade: 0xb0432b,
} as const

/**
 * `truncate` (from salvageunion-reference) cuts at a character count and knows
 * nothing about markdown, so a cut can land inside `[label](url)` and Discord
 * then renders the broken syntax literally. If the tail holds an unterminated
 * link (a trailing `[` with no complete `](url)` after it), drop back to before
 * that `[`.
 */
export function stripDanglingLink(text: string): string {
  const lastOpen = text.lastIndexOf('[')
  if (lastOpen === -1) return text
  const tail = text.slice(lastOpen)
  // A complete link at the tail is fine; anything else is a dangling cut.
  if (/^\[[^\]]*\]\([^)]*\)/.test(tail)) return text
  return text.slice(0, lastOpen).trimEnd()
}
