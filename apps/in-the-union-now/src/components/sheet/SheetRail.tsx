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
 * RailEmpty: the same frame, dashed, with a pale tinted fill, a helper
 * message, create/link CTAs, and an optional mock control (e.g. the
 * hand-set Crawler Level stepper when no crawler is linked).
 */

import type { MouseEvent, ReactNode } from 'react'
import { Bot, ChevronRight, UserRound, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MiniBtn, Pill } from 'suref-react'
import type { PillTone } from 'suref-react'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'
import type { SheetVariant } from './LiveSheet'

const RAIL_BG: Record<SheetVariant, string> = {
  pilot: 'var(--color-pilot)',
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler)',
}

const RAIL_EMPTY_BG: Record<SheetVariant, string> = {
  pilot: 'oklch(from var(--color-pilot) 0.965 0.028 h)',
  mech: 'oklch(from var(--color-mech) 0.965 0.028 h)',
  crawler: 'oklch(from var(--color-crawler) 0.965 0.03 h)',
}

/** Entity-tone empty-slot glyphs (design review U-6) — decorative only. */
const RAIL_EMPTY_ICON: Record<SheetVariant, LucideIcon> = {
  pilot: UserRound,
  mech: Bot,
  crawler: Warehouse,
}

const RAIL_EMPTY_ICON_COLOR: Record<SheetVariant, string> = {
  pilot: 'text-sheet-pilot-deep',
  mech: 'text-sheet-mech-deep',
  crawler: 'text-sheet-crawler-deep',
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
  status?: { label: string; tone?: PillTone }
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
        'relative flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-rail no-underline transition-transform duration-[120ms] hover:-translate-y-px hover:shadow-[0_12px_26px_-14px_rgba(40,32,25,0.55)]',
        className
      )}
      style={{ background: RAIL_BG[tone], borderColor: RAIL_BG[tone] }}
    >
      {/* tone HEAD band (poster `.rail-head`): role+TL `.tag` + name `.stamp` on
          the left, live status + the open chevron on the right. */}
      <span className="flex items-start justify-between gap-2.5 px-3 pt-2.5 pb-2">
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="inline-flex items-stretch self-start overflow-hidden rounded-[2px] border-chrome border-ink font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide">
            <span className="bg-ink px-2 py-1 text-paper">{roleLabel}</span>
            {tl !== undefined && <span className="bg-paper px-2 py-1 text-ink">{`TL${tl}`}</span>}
          </span>
          <span className="min-w-0 truncate bg-ink px-1.5 py-0.5 font-cond text-base font-bold uppercase leading-tight text-paper">
            {name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {status && <Pill tone={status.tone}>{status.label}</Pill>}
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
        <span className="bg-ink px-2 py-1 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-snug text-paper">
          Open sheet &rarr;
        </span>
        <span className="flex items-center gap-1.5">
          {onSwap && <MiniBtn onClick={handleSwap}>&#8644; Swap</MiniBtn>}
          {onUnassign && <MiniBtn onClick={handleUnassign}>&#10005; Unassign</MiniBtn>}
        </span>
      </span>
    </AppLink>
  )
}

type RailEmptyProps = {
  /** The MISSING entity's kind — tints the empty slot. */
  tone: SheetVariant
  /** Black role tab kept even when empty, e.g. 'ASSIGNED MECH'. */
  roleLabel: string
  /** Helper message, e.g. 'No mech in the bay — dock one to track it here.' */
  message: string
  /** Optional mock control (e.g. hand-set Crawler Level StatBlock stepper). */
  mock?: ReactNode
  /** Create/link CTAs, stretched across the foot. */
  actions?: ReactNode
  className?: string
}

export function RailEmpty({ tone, roleLabel, message, mock, actions, className }: RailEmptyProps) {
  const Icon = RAIL_EMPTY_ICON[tone]
  return (
    <div
      className={cn(
        'flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-2 border-dashed border-ink',
        className
      )}
      style={{ background: RAIL_EMPTY_BG[tone] }}
    >
      <span className="self-start bg-ink px-2 pb-0.5 pt-[3px] font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide text-paper">
        {roleLabel}
      </span>
      <div className="flex flex-wrap items-center gap-3 px-2.5 py-2">
        {/* Missing-entity glyph in the entity's own tone (U-6, decorative). */}
        <Icon aria-hidden="true" className={cn('size-6 shrink-0', RAIL_EMPTY_ICON_COLOR[tone])} />
        {mock}
        <p
          className="m-0 min-w-[140px] flex-1 font-body text-note leading-snug"
          style={{ color: 'var(--tone-deep)' }}
        >
          {message}
        </p>
      </div>
      {actions && (
        <div className="mt-auto flex items-stretch gap-2 border-t-2 border-dashed border-ink px-2.5 py-1.5 *:flex-1">
          {actions}
        </div>
      )}
    </div>
  )
}
