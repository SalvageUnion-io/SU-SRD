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
  /** For a region that names itself by its slab (`aria-labelledby`). */
  id?: string
  /**
   * 'dashed' (default, unchanged) — tone-deep colored text label + dashed
   * leader rule, the original live-play control-panel shape. 'solid' — the
   * section stamp of the brand refresh (boards 06–10): a solid ink stamp,
   * paper text, then a dashed ink hairline running to the count at the far
   * end ("PATTERNS ┄┄┄ 5 patterns"). It replaced the centred rust
   * `SectionHeader` and the roster's column headings.
   */
  variant?: 'dashed' | 'solid'
}

/**
 * The section header (ruleset §5 atom 7, "section stamp + leader rule";
 * design-spec §2.10 `.slab`): an uppercase cond label with a leader rule.
 * Default ('dashed') keeps the original tone-deep text + dashed rule; 'solid'
 * is the ink section stamp with its count at the end of the rule.
 */
export function Slab({ label, as, count, actions, className, id, variant = 'dashed' }: SlabProps) {
  const isSolid = variant === 'solid'
  const Label = as ?? 'span'
  const countNode = count != null && (
    <span className="shrink-0 font-body text-xs font-bold normal-case tracking-normal text-wk-muted">
      {count}
    </span>
  )
  return (
    <div className={cn('mb-3.5 flex items-center gap-3', className)}>
      {isSolid ? (
        <Label
          id={id}
          className={cn(POSTER_STAMP, 'shrink-0 px-2 pb-[3px] pt-[2px] text-sm leading-relaxed')}
        >
          {label}
        </Label>
      ) : (
        <Label
          id={id}
          className="shrink-0 font-cond text-sm font-bold uppercase tracking-caps-wide"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          {label}
        </Label>
      )}
      {/* The dashed slab counts beside its label; the solid one at the rule's end. */}
      {!isSolid && countNode}
      {isSolid ? (
        <span
          aria-hidden="true"
          className="h-0 min-w-3 flex-1 border-t border-dashed border-ink-50"
        />
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
      {isSolid && countNode}
      {/* A div, not a span: actions carry block-level content (the Ko-fi widget
          renders a div), and a div inside a span is invalid HTML. Both are flex
          items of the same row, so nothing moves. */}
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}
