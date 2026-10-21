import type { Size } from '../../styles/sizing'

/**
 * THE card sizing vocabulary — owned here and read by every card
 * (`ReferenceEntityCard`, the Peek's Compact contentful).
 *
 * Two axes, deliberately ORTHOGONAL, so every combination is expressible — a
 * mini card can still show its content.
 *
 * SIZE — how big the card renders: the app's three Sizes (`styles/sizing.ts`):
 * - `full`    — the dominant solo card.
 * - `compact` — reduced density; nested cards are always at least this.
 * - `mini`    — the shortform scale.
 *
 * EXTENT — how much of the entity renders, at whatever size (the EDL's
 * header-only and contentful):
 * - `full`    — contentful: head, body, nested content, foot. At `compact`
 *               the EDL's Compact contentful, at `full` its Full contentful.
 * - `head`    — header-only, and so a Mini at every size (`HeadMini`, N2).
 *               A header-only Compact is `<Entity size="compact">`, never
 *               this card.
 * - `catalog` — artwork and description only: every nested element
 *               (entities, actions, choices, patterns, roll tables) and the
 *               foot suppressed; at `mini` the artwork too. The class picker's
 *               options draw it; an SRD index is `<Entity layout="index">`.
 */
export type CardExtent = 'full' | 'head' | 'catalog'

/** The two axes together — what every card layer resolves its rendering from. */
export type CardDisplay = { size: Size; extent: CardExtent }

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
  size?: Size
  extent?: CardExtent
}): CardDisplay {
  return { size: size ?? 'full', extent: extent ?? 'full' }
}
