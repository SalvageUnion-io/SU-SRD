/**
 * THE card display-mode vocabulary — owned here, at the `DisplayCard` layer, and
 * inherited by every card that composes it (notably `ReferenceEntityCard`).
 *
 * There used to be two names for one axis: this module said `head` while
 * `entityCardTone.ts` said `listing`, and `catalog` existed only on the entity
 * card. A card that wanted the header-only rendering therefore spelled it
 * differently depending on which layer you were standing on, and the entity card
 * reconciled `size` / `mode` / `compact` / `listing` with its own ternary chain.
 * One type + one resolver, here, is what makes the two layers agree.
 *
 * The modes:
 * - `full`    — the dominant solo card: header, body, expand slot, footer.
 * - `compact` — the same anatomy at reduced density (nested cards are always this).
 * - `listing` — the dense header-only row: body, expand and footer are suppressed.
 * - `badge`   — the SHORTFORM token: one tone-filled pill carrying the type
 *               stamp, the name, and the classification tail (TL, or Tree · Level).
 * - `catalog` — the SRD index tile: compact, artwork + description ONLY, with
 *               every nested element (entities, actions, choices, patterns, roll
 *               tables) suppressed so an index page reads uniformly whatever the
 *               entity type happens to be.
 */
export type CardDisplayMode = 'full' | 'compact' | 'listing' | 'badge' | 'catalog'

/**
 * The mode → `{compact, listing}` projection that `DisplayCard` lays out from.
 *
 * `badge` and `catalog` are card SIZES rather than a boolean pair — a consumer
 * that understands them reads the mode directly (see {@link resolveCardMode});
 * the projection below is the fallback for the boolean-driven layout inside
 * `DisplayCard` itself. `badge` collapses to a header-only row, `catalog` to a
 * compact one.
 */
const MODE_MAP: Record<CardDisplayMode, { compact: boolean; listing: boolean }> = {
  full: { compact: false, listing: false },
  compact: { compact: true, listing: false },
  listing: { compact: true, listing: true },
  badge: { compact: true, listing: true },
  catalog: { compact: true, listing: false },
}

/**
 * Resolve the `compact` / `listing` booleans from a mode. The booleans stay
 * supported and, when explicitly provided, take precedence over `mode`.
 */
export function resolveDisplayMode(
  mode: CardDisplayMode | undefined,
  compact: boolean | undefined,
  listing: boolean | undefined
): { compact: boolean; listing: boolean } {
  const fromMode = mode ? MODE_MAP[mode] : undefined
  return {
    compact: compact ?? fromMode?.compact ?? false,
    listing: listing ?? fromMode?.listing ?? false,
  }
}

/**
 * Collapse every way a caller can express density — an explicit `size`, the
 * `mode` sugar, or the `compact` / `listing` booleans — into the ONE canonical
 * mode. This is the rule the entity card used to carry inline; it lives here so
 * the card inherits it rather than restating it.
 *
 * Precedence: an explicit `size` wins outright; then the sizes that have no
 * boolean equivalent (`badge`, `catalog`); then the boolean projection.
 */
export function resolveCardMode({
  size,
  mode,
  compact,
  listing,
}: {
  size?: CardDisplayMode
  mode?: CardDisplayMode
  compact?: boolean
  listing?: boolean
}): CardDisplayMode {
  if (size) return size
  if (mode === 'badge' || mode === 'catalog') return mode
  const resolved = resolveDisplayMode(mode, compact, listing)
  return resolved.listing ? 'listing' : resolved.compact ? 'compact' : 'full'
}
