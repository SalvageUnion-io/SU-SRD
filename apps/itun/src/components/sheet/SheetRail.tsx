/**
 * SheetRail — linked-entity rail chips (design §2.11, plan 4.3; restyled to
 * the poster `.rail` / `.rail-head` / `.rail-body` (redesign gap G10)).
 *
 * RailChip: an anchor mini entity-card in the linked entity's own tone (a
 * 2.5px tone border/fill, matching `clean-pilot.html` `.rail.teal` /
 * `.rail.magenta`) with a tone HEAD band (role+TL `.tag`, name `.stamp`, an
 * open chevron) and a paper BODY block with an ink left rule carrying
 * INLINE NUMERIC TEXT stats (e.g. "SP 9/13 · EP 6/11 · Heat 4/12") — never
 * VitalGauges or StatBlocks (resolved by the composition resolver — names
 * and stats, never raw IDs [gap 10]). The whole card navigates ("Open sheet
 * →" foot); the optional '⇄ Swap' minibtn intercepts.
 *
 * The empty slot is the shared `EntityRow` `empty` variant (component-lib) —
 * the sheets render it directly for unfilled links.
 */

import type { MouseEvent, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, Button } from 'component-lib'
import type { BadgeTone } from 'component-lib'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'
import type { SheetVariant } from './LiveSheet'

const RAIL_BG: Record<SheetVariant, string> = {
  pilot: 'var(--color-pilot)',
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler)',
}

type RailChipProps = {
  /** The linked entity's kind — sets the chip's own color. */
  tone: SheetVariant
  /** Black role tab, e.g. 'ASSIGNED MECH', 'LEAD PILOT'. */
  roleLabel: string
  name: string
  href: string
  /** Optional 26px black TL badge. */
  tl?: number
  status?: { label: string; tone?: BadgeTone }
  /** Live mini stats of the linked entity (sm StatBlocks). */
  stats?: ReactNode
  /** Renders the '⇄ Swap' minibtn when provided (stops navigation). */
  onSwap?: () => void
  /**
   * Renders the '✕ Unassign' minibtn when provided (stops navigation).
   * Relocated from the removed detail page: the views wire this only while
   * the sheet is in build-edit mode so it can't be hit accidentally in play.
   */
  onUnassign?: () => void
  className?: string
}

export function RailChip({
  tone,
  roleLabel,
  name,
  href,
  tl,
  status,
  stats,
  onSwap,
  onUnassign,
  className,
}: RailChipProps) {
  function handleSwap(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onSwap?.()
  }

  function handleUnassign(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onUnassign?.()
  }

  return (
    <AppLink
      href={href}
      aria-label={`${roleLabel}: ${name} — open sheet`}
      className={cn(
        'relative flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-rail no-underline transition-transform duration-[120ms] hover:-translate-y-px hover:shadow-[0_12px_26px_-14px_var(--color-ink-50)]',
        className
      )}
      style={{ background: RAIL_BG[tone], borderColor: RAIL_BG[tone] }}
    >
      {/* tone HEAD band (poster `.rail-head`): role+TL `.tag` + name `.stamp` on
          the left, live status + the open chevron on the right. */}
      <span className="flex items-start justify-between gap-2.5 px-3 pt-2.5 pb-2">
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="inline-flex items-stretch self-start overflow-hidden rounded-[2px] border-chrome border-ink">
            <Badge shape="stamp" size="mini" className="px-2 py-1 tracking-caps-wide">
              {roleLabel}
            </Badge>
            {tl !== undefined && (
              <Badge
                shape="stamp"
                size="mini"
                surface="inverse"
                // `ring-0`: the outer span draws the ink frame, so the inverse
                // plate's own ring would double the seam.
                className="px-2 py-1 tracking-caps-wide ring-0"
              >
                {`TL${tl}`}
              </Badge>
            )}
          </span>
          <Badge shape="stamp" size="full" className="block min-w-0 max-w-full truncate">
            {name}
          </Badge>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {status && (
            <Badge surface={status.tone ? 'tone' : 'outline'} tone={status.tone}>
              {status.label}
            </Badge>
          )}
          <ChevronRight aria-hidden="true" className="size-4 text-ink/80" />
        </span>
      </span>

      {/* paper BODY (poster `.rail-body`): an ink left rule + inline numeric
          text stats — never VitalGauges or StatBlocks here. */}
      {stats && (
        <span className="mx-2.5 mb-2.5 border-l-[3px] border-ink bg-paper px-2.5 py-2 font-cond text-[12px] font-semibold uppercase leading-snug tracking-caps text-ink/70 [&_b]:font-bold [&_b]:text-ink">
          {stats}
        </span>
      )}

      <span
        className="mt-auto flex items-center justify-between gap-2 border-t-2 border-ink px-2.5 py-1.5"
        style={{ background: RAIL_BG[tone] }}
      >
        <Badge shape="stamp" size="mini" className="px-2 py-1 tracking-caps-snug">
          Open sheet &rarr;
        </Badge>
        <span className="flex items-center gap-1.5">
          {onSwap && (
            <Button size="mini" onClick={handleSwap}>
              &#8644; Swap
            </Button>
          )}
          {onUnassign && (
            <Button size="mini" onClick={handleUnassign}>
              &#10005; Unassign
            </Button>
          )}
        </span>
      </span>
    </AppLink>
  )
}
