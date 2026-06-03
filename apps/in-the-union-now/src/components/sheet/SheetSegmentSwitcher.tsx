/**
 * SheetSegmentSwitcher — mobile-only segmented control for the live sheet
 * (design board-screens.jsx → SheetMobile). Renders a row of `.btn`-style
 * segments (Pilot | Mech | Crawler); the active segment is filled with its
 * per-kind semantic accent (pilot orange / mech green / crawler pink) and the
 * inactive segments carry that accent on their border + label, so each tab
 * reads as its own entity kind — including on hover.
 *
 * Only the segments passed in `segments` are rendered, so a pilot-only sheet
 * shows a single Pilot segment (and a wired pilot+mech sheet shows two). The
 * caller owns the selected-segment state — this component is presentational.
 */

import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'
import { sheetAccentFor } from './sheetAccent'

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
        const accent = sheetAccentFor(segment)
        return (
          <button
            key={segment}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(segment)}
            className={cn(
              buttonVariants({ variant: isActive ? 'default' : 'outline', size: 'sm' }),
              'flex-1',
              // Tint per-segment with its entity-kind accent: the active segment
              // is filled with the kind's semantic color; inactive segments carry
              // the accent on their border + label so the kind reads at a glance.
              //
              // The button `default`/`outline` variants carry their own
              // rust/orange-dark hover colors, so we re-state the accent's
              // fill/border/text hover utilities here. They land after the
              // variant classes in `cn()`, so tailwind-merge lets the accent win
              // and each segment keeps its own kind color while interacting.
              isActive
                ? cn(accent.bg, accent.bgText, accent.border, accent.hoverBg, accent.hoverBorder)
                : cn(
                    accent.border,
                    accent.text,
                    accent.hoverBgTint,
                    accent.hoverBorder,
                    accent.hoverText
                  )
            )}
          >
            {SEGMENT_LABELS[segment]}
          </button>
        )
      })}
    </div>
  )
}
