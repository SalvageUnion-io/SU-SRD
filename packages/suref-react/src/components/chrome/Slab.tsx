import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type SlabProps = {
  /** Section label, e.g. 'Systems' */
  label: ReactNode
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
   * consumers (and any future suref-web use) keep the default unless they
   * ask for the poster shape.
   */
  variant?: 'dashed' | 'solid'
}

/**
 * Live-sheet section header (design-spec §2.10 `.slab`): uppercase cond label
 * with a leader rule. Default ('dashed') keeps the original tone-deep text +
 * dashed rule; 'solid' matches the poster `.sect` region-divider shape.
 */
export function Slab({ label, count, actions, className, variant = 'dashed' }: SlabProps) {
  const isSolid = variant === 'solid'
  return (
    <div className={cn('mb-3.5 flex items-center gap-3', className)}>
      {isSolid ? (
        <span className="box-decoration-clone inline shrink-0 bg-ink px-2 pb-[3px] pt-[2px] font-cond text-sm font-bold uppercase leading-relaxed tracking-[0.09em] text-paper">
          {label}
        </span>
      ) : (
        <span
          className="shrink-0 font-cond text-sm font-bold uppercase tracking-caps-wide"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          {label}
        </span>
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
      {actions && <span className="flex shrink-0 items-center gap-1.5">{actions}</span>}
    </div>
  )
}
