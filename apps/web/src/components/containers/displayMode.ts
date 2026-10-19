import type { Size } from '../../styles/sizing'

/**
 * THE card sizing vocabulary — owned here and read by every card
 * (`ReferenceEntityCard`, the Peek's compact Card).
 *
 * Two axes, deliberately ORTHOGONAL, so every combination is expressible — a
 * mini card can still show its content.
 *
 * SIZE — how big the card renders: the app's three Sizes (`styles/sizing.ts`):
 * - `full`    — the dominant solo card.
 * - `compact` — reduced density; nested cards are always at least this.
 * - `mini`    — the shortform scale.
 *
 * EXTENT — how much of the entity renders, at whatever size:
 * - `full`    — the whole card: header, body, expand slot, footer.
 * - `head`    — the COMPACT CARD: the art column, the head row and a paper
 *               body of value cells and the "//" line; the prose, expand and
 *               footer are suppressed. At `mini` this is the shortform token:
 *               one tone-filled pill carrying the type stamp, the name and the
 *               classification tail.
 * - `catalog` — the index tile: artwork + description ONLY, with every nested
 *               element (entities, actions, choices, patterns, roll tables)
 *               suppressed so an index page reads uniformly whatever the entity
 *               type happens to be. At `mini` the artwork is dropped too.
 */
export type CardSize = Size

export type CardExtent = 'full' | 'head' | 'catalog'

/** The two axes together — what every card layer resolves its rendering from. */
export type CardDisplay = { size: CardSize; extent: CardExtent }

/**
 * The defaults for the two axes — a card with neither specified is the dominant
 * solo rendering. There is deliberately no boolean sugar: a `compact` /
 * `listing` pair cannot express `mini` + `full`, and would re-admit the drift
 * this module exists to prevent.
 */
export function resolveCardDisplay({
  size,
  extent,
}: {
  size?: CardSize
  extent?: CardExtent
}): CardDisplay {
  return { size: size ?? 'full', extent: extent ?? 'full' }
}
