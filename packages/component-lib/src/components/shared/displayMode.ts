/**
 * Card display modes (design-spec §2.1): `full` (default), `compact` (reduced
 * sizing), `head` (dense header-only listing row), `badge` (the shortform token
 * — a single tone-filled pill: type stamp, name, TL / Tree · Level). Pure sugar
 * over the existing `compact`/`listing` booleans — the booleans stay supported
 * and, when explicitly provided, take precedence over `mode`.
 *
 * `badge` is a distinct card SIZE, not a boolean pair; the shim reads it as a
 * `size` directly. The `{compact, listing}` fallback below (header-only) is only
 * for a boolean-driven consumer that hasn't been taught the badge size.
 */
export type EntityDisplayMode = 'full' | 'compact' | 'head' | 'badge'

const MODE_MAP: Record<EntityDisplayMode, { compact: boolean; listing: boolean }> = {
  full: { compact: false, listing: false },
  compact: { compact: true, listing: false },
  head: { compact: true, listing: true },
  badge: { compact: true, listing: true },
}

export function resolveDisplayMode(
  mode: EntityDisplayMode | undefined,
  compact: boolean | undefined,
  listing: boolean | undefined
): { compact: boolean; listing: boolean } {
  const fromMode = mode ? MODE_MAP[mode] : undefined
  return {
    compact: compact ?? fromMode?.compact ?? false,
    listing: listing ?? fromMode?.listing ?? false,
  }
}
