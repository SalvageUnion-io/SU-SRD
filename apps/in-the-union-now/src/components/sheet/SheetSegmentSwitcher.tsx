/**
 * SheetSegmentSwitcher — mobile-only segmented control for the live sheet
 * (design board-screens.jsx → SheetMobile). Renders a row of `.btn`-style
 * segments (Pilot | Mech | Crawler); the active segment is filled with the
 * rust/orange-dark accent (button `default` variant) and the rest are
 * `outline`.
 *
 * Only the segments passed in `segments` are rendered, so a pilot-only sheet
 * shows a single Pilot segment (and a wired pilot+mech sheet shows two). The
 * caller owns the selected-segment state — this component is presentational.
 */

import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'

export type SheetSegment = 'pilot' | 'mech' | 'crawler'

const SEGMENT_LABELS: Record<SheetSegment, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

type SheetSegmentSwitcherProps = {
  /** Segments to render, in display order. Only present entities should be passed. */
  segments: ReadonlyArray<SheetSegment>
  /** Currently-active segment. */
  active: SheetSegment
  /** Called with the tapped segment. */
  onChange: (segment: SheetSegment) => void
  className?: string
}

export function SheetSegmentSwitcher({
  segments,
  active,
  onChange,
  className,
}: SheetSegmentSwitcherProps) {
  return (
    <div role="tablist" aria-label="Sheet section" className={cn('flex gap-2', className)}>
      {segments.map((segment) => {
        const isActive = segment === active
        return (
          <button
            key={segment}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(segment)}
            className={cn(
              buttonVariants({ variant: isActive ? 'default' : 'outline', size: 'sm' }),
              'flex-1'
            )}
          >
            {SEGMENT_LABELS[segment]}
          </button>
        )
      })}
    </div>
  )
}
