/**
 * Card display modes (design-spec §2.1): `full` (default), `compact` (reduced
 * sizing), `head` (dense header-only listing row). Pure sugar over the
 * existing `compact`/`listing` booleans — the booleans stay supported and,
 * when explicitly provided, take precedence over `mode`.
 */
export type EntityDisplayMode = 'full' | 'compact' | 'head'

const MODE_MAP: Record<EntityDisplayMode, { compact: boolean; listing: boolean }> = {
  full: { compact: false, listing: false },
  compact: { compact: true, listing: false },
  head: { compact: true, listing: true },
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
