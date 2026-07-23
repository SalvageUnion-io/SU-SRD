import type { ElementType, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { POSTER_STAMP } from './posterStamp'

type SlabProps = {
  /** Section label, e.g. 'Systems' */
  label: ReactNode
  /**
   * Element for the label. Defaults to `span`: inside an entity card a slab is
   * a visual separator, not a document heading. Prose pages (the about/back
   * pages) that use it as their real section head pass `h2` so the outline and
   * screen-reader navigation still work.
   */
  as?: ElementType
  /** Muted count suffix, e.g. '2' or '3 lots · 5/6 slots' */
  count?: ReactNode
  /**
   * Trailing section controls after the leader rule (e.g. a per-section Edit
   * toggle or an always-available '+ Add'). Optional and additive — existing
   * consumers render unchanged.
   */
  actions?: ReactNode
  className?: string
  /**
   * 'dashed' (default, unchanged) — tone-deep colored text label + dashed
   * leader rule, the original live-play control-panel shape. 'solid' — the
   * poster `.sect` shape (clean-pilot.html :215-218): black-stamp label
   * (white-on-ink) + a SOLID ink-35 leader rule. Additive opt-in so existing
   * consumers (and any future srd use) keep the default unless they
   * ask for the poster shape.
   */
  variant?: 'dashed' | 'solid'
}

/**
 * Live-sheet section header (design-spec §2.10 `.slab`): uppercase cond label
 * with a leader rule. Default ('dashed') keeps the original tone-deep text +
 * dashed rule; 'solid' matches the poster `.sect` region-divider shape.
 */
export function Slab({ label, as, count, actions, className, variant = 'dashed' }: SlabProps) {
  const isSolid = variant === 'solid'
  const Label = as ?? 'span'
  return (
    <div className={cn('mb-3.5 flex items-center gap-3', className)}>
      {isSolid ? (
        <Label
          className={cn(POSTER_STAMP, 'shrink-0 px-2 pb-[3px] pt-[2px] text-sm leading-relaxed')}
        >
          {label}
        </Label>
      ) : (
        <Label
          className="shrink-0 font-cond text-sm font-bold uppercase tracking-caps-wide"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          {label}
        </Label>
      )}
      {count != null && (
        <span className="shrink-0 font-body text-xs font-bold normal-case tracking-normal text-wk-muted">
          {count}
        </span>
      )}
      {isSolid ? (
        <span aria-hidden="true" className="h-0 min-w-3 flex-1 border-t-chrome border-ink/35" />
      ) : (
        <span
          aria-hidden="true"
          className="h-0.5 flex-1 opacity-40"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--tone-deep, var(--color-ink)) 0 6px, transparent 6px 11px)',
          }}
        />
      )}
      {/* A div, not a span: actions carry block-level content (the Ko-fi widget
          renders a div), and a div inside a span is invalid HTML. Both are flex
          items of the same row, so nothing moves. */}
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}
