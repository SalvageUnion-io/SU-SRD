/**
 * The bot's glyph vocabulary: die plates and tier banners.
 *
 * ## One block, and only the proven half of it
 *
 * Every ornament here comes from Unicode Block Elements (U+2580–U+259F),
 * because `gauge()` in `gameEmbed.ts` already draws vitals as `██████░░░░` and
 * a bot that renders heat that way and dice with 🎲 has two typographic systems
 * and belongs to neither.
 *
 * Narrower than that: only the **shade** characters `░ ▒ ▓ █` and the two half
 * blocks `▌ ▐`. An earlier draft used `▚` (U+259A), a *quadrant* character.
 * Quadrants are the weakest-covered glyphs in the block and the most likely to
 * fall back to another font — which in a tiled run shows up as gaps and uneven
 * weight, the one failure mode a banner cannot survive. `█` and `░` are proven
 * by the shipped `gauge()`; the shades sit beside them in the same CP437 set.
 *
 * ## Why the banner is reserved for the extremes
 *
 * A natural 1 and a natural 20 get a banner. Bands 2–19 get nothing. An
 * ornament on every tier is not a signal, it is texture — restraint is the
 * entire mechanism. The tier is always *named* in the headline and *coloured*
 * on the container accent, so a banner adds emphasis and never information; a
 * screen reader that skips it loses nothing.
 *
 * See `docs/design/discord-bot-roll-experience.md` §5b.
 */

import type { CoreRollBand } from 'salvageunion-reference/rules'

/** Width of a banner run, in glyphs. Tuned to span a mobile embed without wrapping. */
const BANNER_WIDTH = 30

/**
 * Cascade banner — a repeating heavy→light sawtooth.
 *
 * The eye follows the falling weight and reads it as diagonal motion, which is
 * what makes it scan as hazard tape rather than as a progress bar. Period 3.
 */
function sawtooth(width: number): string {
  const cell = '▓▒░'
  return Array.from({ length: width }, (_, i) => cell[i % cell.length]).join('')
}

/**
 * Nailed It banner — a single centred swell.
 *
 * The exact inverse motion to the cascade sawtooth, in the same four glyphs:
 * repetition reads as alarm, one peak reads as a summit. Same vocabulary, two
 * moods, which is what makes the pair read as one system.
 */
function swell(width: number): string {
  const ramp = '░▒▓█'
  const mid = (width - 1) / 2
  return Array.from({ length: width }, (_, i) => {
    // 0 at the edges → 1 at the centre, mapped onto the four shades.
    const t = 1 - Math.abs(i - mid) / mid
    const index = Math.min(ramp.length - 1, Math.floor(t * ramp.length))
    return ramp[index]
  }).join('')
}

/**
 * The banner for a Core Mechanic band, or `null` for the fourteen ordinary
 * outcomes between them.
 *
 * Returns the bare glyph run — the caller decides the weight by placing it on a
 * `-#` subtext line or a plain one. Subtext is the intended home: it keeps the
 * banner a printed rule rather than a bar competing with the headline.
 */
export function tierBanner(band: CoreRollBand): string | null {
  if (band === 'cascade') return sawtooth(BANNER_WIDTH)
  if (band === 'nailed') return swell(BANNER_WIDTH)
  return null
}

/**
 * A die result stamped into a plate: `▌20▐`.
 *
 * Used only for a die result, never as decoration. Rendered inside a `##`
 * heading it comes out around three times the size of the field value it
 * replaces, which is the whole point — the number people shout across the table
 * was previously the smallest text in the embed.
 */
export function diePlate(roll: number | string): string {
  return `▌${roll}▐`
}

/** A lit status block, for the "recorded to a Game" line. */
export const STATUS_LED = '█'
