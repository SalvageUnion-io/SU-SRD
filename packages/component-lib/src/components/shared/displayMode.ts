/**
 * THE card sizing vocabulary — owned here, at the `DisplayCard` layer, and
 * inherited by every card that composes it (notably `ReferenceEntityCard`).
 *
 * Two axes, deliberately ORTHOGONAL. They used to be one conflated enum
 * (`full | compact | listing | badge | catalog`), which is why there was no way
 * to ask for a small card that still showed its content: picking the small
 * scale (`badge`) also picked the header-only extent. Splitting them is what
 * makes every combination expressible.
 *
 * SIZE — how big the card renders. Three rungs, and only three:
 * - `large`  — the dominant solo card (the former `full`).
 * - `medium` — reduced density; nested cards are always at least this (`compact`).
 * - `small`  — the shortform scale (the former `badge`).
 *
 * EXTENT — how much of the entity renders, at whatever size:
 * - `full`    — the whole card: header, body, expand slot, footer.
 * - `head`    — header only; body, expand and footer are suppressed. At `small`
 *               this is the shortform token: one tone-filled pill carrying the
 *               type stamp, the name and the classification tail.
 * - `catalog` — the index tile: artwork + description ONLY, with every nested
 *               element (entities, actions, choices, patterns, roll tables)
 *               suppressed so an index page reads uniformly whatever the entity
 *               type happens to be. At `small` the artwork is dropped too.
 */
export type CardSize = 'large' | 'medium' | 'small'

export type CardExtent = 'full' | 'head' | 'catalog'

/** The two axes together — what every card layer resolves its rendering from. */
export type CardDisplay = { size: CardSize; extent: CardExtent }

/**
 * The size → `{compact, listing}` projection that `DisplayCard`'s layout still
 * reads from. `compact` covers both reduced rungs, since `small` inherits
 * medium's tighter padding and then steps its type down further.
 */
export function displayBooleans({ size, extent }: CardDisplay): {
  compact: boolean
  listing: boolean
} {
  return { compact: size !== 'large', listing: extent === 'head' }
}

/**
 * Collapse every way a caller can express sizing — an explicit `size`/`extent`,
 * or the `compact` / `listing` booleans — into the ONE canonical pair. This is
 * the rule the entity card used to carry inline; it lives here so the card
 * inherits it rather than restating it.
 *
 * Precedence: explicit `size`/`extent` win outright; otherwise the booleans
 * project onto the axes (`listing` ⇒ head extent at medium size).
 */
export function resolveCardDisplay({
  size,
  extent,
  compact,
  listing,
}: {
  size?: CardSize
  extent?: CardExtent
  compact?: boolean
  listing?: boolean
}): CardDisplay {
  const resolvedExtent = extent ?? (listing ? 'head' : 'full')
  const resolvedSize = size ?? (compact || listing ? 'medium' : 'large')
  return { size: resolvedSize, extent: resolvedExtent }
}
