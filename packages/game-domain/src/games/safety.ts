/**
 * Safety Protocols, as a Game keeps them (Core Book pp.12-13): the table's
 * boundaries, in the book's two lists, and the Stop Sign anyone may show.
 *
 * Shared by the server (`convex/safety.ts` checks the caps), the Game page's
 * Safety section and Play's Stop button, so the list names and limits are one
 * set. Pure: no React, no Convex.
 */

/**
 * The book's two kinds of boundary. **Out of Bounds**: not used in the game
 * at all. **Off Camera**: may happen, but only indirectly, in the background.
 */
export const BOUNDARY_KINDS = ['outOfBounds', 'offCamera'] as const

export type BoundaryKind = (typeof BOUNDARY_KINDS)[number]

/** The longest boundary, after trimming. */
export const BOUNDARY_TEXT_MAX = 140

/** The most boundaries one Game keeps, both lists together. */
export const BOUNDARIES_MAX = 60

/** A boundary's words as stored: trimmed, inner runs of space collapsed. */
export function normalizeBoundary(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Why a boundary cannot be added, or null when it can. */
export function boundaryRefusal(text: string): string | null {
  const words = normalizeBoundary(text)
  if (words.length === 0) return 'A boundary needs some words.'
  if (words.length > BOUNDARY_TEXT_MAX) {
    return `A boundary is at most ${BOUNDARY_TEXT_MAX} characters.`
  }
  return null
}
