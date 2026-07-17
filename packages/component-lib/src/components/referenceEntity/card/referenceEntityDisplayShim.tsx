import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { type EntityDisplayMode, resolveDisplayMode } from '../../shared/displayMode'
import type { StatItem } from '../../shared/statsBarTypes'
import { ReferenceEntityCard, type ReferenceEntityCardProps } from './ReferenceEntityCard'

/** Legacy `statsOverride` sugar — the old single-SV override shape. */
type LegacyStatsOverride = { value: number | string; bottomLabel: string }

/**
 * `ReferenceEntityDisplay` — the CUTOVER COMPAT SHIM (temporary).
 *
 * Lets every legacy consumer render through the canonical `ReferenceEntityCard`
 * without a call-site rewrite. It maps the legacy display sugar to the new API:
 *   - `mode` / `compact` / `listing` → `size` (`resolveDisplayMode`)
 *   - `status` = damaged/destroyed folds into `damaged` (legacy behaviour)
 *   - the old single-SV `statsOverride: {value, bottomLabel}` → a `StatItem[]`
 * Everything else forwards 1:1 (the shim's props are the card's own props + the
 * sugar, so the forward is type-safe). Deleted at cutover Stage d, when consumers
 * call the canonical card directly.
 */
type ReferenceEntityDisplayProps = Omit<
  ReferenceEntityCardProps,
  'size' | 'statsOverride' | 'data'
> & {
  data: SURefEntity | undefined
  compact?: boolean
  listing?: boolean
  mode?: EntityDisplayMode
  statsOverride?: StatItem[] | LegacyStatsOverride
}

export function ReferenceEntityDisplay({
  data,
  compact: compactProp,
  listing: listingProp,
  mode,
  status,
  damaged,
  statsOverride,
  ...rest
}: ReferenceEntityDisplayProps): ReactNode {
  if (!data) return null

  const { compact, listing } = resolveDisplayMode(mode, compactProp, listingProp)
  const size = listing ? 'listing' : compact ? 'compact' : 'full'
  // `status` supersets `damaged` — a damaged/destroyed status greys the header the
  // same way the boolean always has (legacy `ReferenceEntityDisplay` behaviour).
  const effectiveDamaged = damaged || status === 'damaged' || status === 'destroyed'
  const stats: StatItem[] | undefined = statsOverride
    ? Array.isArray(statsOverride)
      ? statsOverride
      : [
          {
            key: 'sv-override',
            label: 'Salvage',
            bottomLabel: statsOverride.bottomLabel,
            value: statsOverride.value,
          },
        ]
    : undefined

  return (
    <ReferenceEntityCard
      data={data}
      size={size}
      status={status}
      damaged={effectiveDamaged}
      statsOverride={stats}
      {...rest}
    />
  )
}
