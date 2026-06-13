/**
 * SheetRail — linked-entity rail chips (design §2.11, plan 4.3).
 *
 * RailChip: an anchor mini entity-card in the linked entity's own color with
 * live sm-StatBlock readouts (resolved by the composition resolver — names
 * and stats, never raw IDs [gap 10]). The whole card navigates; the optional
 * '⇄ Swap' minibtn intercepts.
 *
 * RailEmpty: the same frame, dashed, with a pale tinted fill, a helper
 * message, create/link CTAs, and an optional mock control (e.g. the
 * hand-set Crawler Level stepper when no crawler is linked).
 */

import type { MouseEvent, ReactNode } from 'react'
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
  className,
}: RailChipProps) {
  function handleSwap(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onSwap?.()
  }

  return (
    <AppLink
      href={href}
      aria-label={`${roleLabel}: ${name} — open sheet`}
      className={cn(
        'relative flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-[2.5px] border-ink no-underline transition-transform duration-[120ms] hover:-translate-y-px hover:shadow-[0_12px_26px_-14px_rgba(40,32,25,0.55)]',
        className
      )}
      style={{ background: RAIL_BG[tone] }}
    >
      <span className="self-start bg-ink px-2 pb-0.5 pt-[3px] font-cond text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-su-white">
        {roleLabel}
      </span>
      {status && (
        <span className="absolute right-2 top-[7px]">
          <Pill tone={status.tone}>{status.label}</Pill>
        </span>
      )}

      <span className="flex items-center gap-2 px-2.5 pt-2">
        {tl !== undefined && (
          <span className="flex h-[26px] w-[26px] shrink-0 flex-col items-center justify-center bg-ink leading-none text-su-white">
            <span className="font-body text-xs font-bold">{tl}</span>
            <span className="font-cond text-[8px] opacity-85">TL</span>
          </span>
        )}
        <span className="min-w-0 truncate bg-ink px-1.5 py-0.5 font-cond text-[17px] font-bold uppercase leading-tight text-su-white">
          {name}
        </span>
      </span>

      {stats && <span className="flex flex-wrap items-start gap-1.5 px-2.5 py-2">{stats}</span>}

      <span
        className="mt-auto flex items-center justify-between gap-2 border-t-2 border-ink px-2.5 py-1.5"
        style={{ background: RAIL_BG[tone] }}
      >
        <span className="bg-ink px-2 py-1 font-cond text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-su-white">
          Open sheet &rarr;
        </span>
        {onSwap && <MiniBtn onClick={handleSwap}>&#8644; Swap</MiniBtn>}
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
  return (
    <div
      className={cn(
        'flex min-w-0 flex-[1_1_0%] flex-col overflow-hidden rounded-[3px] border-2 border-dashed border-ink',
        className
      )}
      style={{ background: RAIL_EMPTY_BG[tone] }}
    >
      <span className="self-start bg-ink px-2 pb-0.5 pt-[3px] font-cond text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-su-white">
        {roleLabel}
      </span>
      <div className="flex flex-wrap items-center gap-3 px-2.5 py-2">
        {mock}
        <p
          className="m-0 min-w-[140px] flex-1 font-body text-[11.5px] leading-snug"
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
