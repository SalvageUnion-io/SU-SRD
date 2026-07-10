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
}

/**
 * Live-sheet section header (design-spec §2.10 `.slab`): uppercase cond label
 * in the sheet's `--tone-deep` (ink fallback) with a dashed leader rule.
 */
export function Slab({ label, count, actions, className }: SlabProps) {
  return (
    <div
      className={cn(
        'mb-3.5 flex items-center gap-3 font-cond text-sm font-bold uppercase tracking-[0.12em]',
        className
      )}
      style={{ color: 'var(--tone-deep, var(--color-ink))' }}
    >
      <span className="shrink-0">{label}</span>
      {count != null && (
        <span className="shrink-0 font-body text-xs font-bold normal-case tracking-normal text-wk-muted">
          {count}
        </span>
      )}
      <span
        aria-hidden="true"
        className="h-0.5 flex-1 opacity-40"
        style={{
          background:
            'repeating-linear-gradient(90deg, var(--tone-deep, var(--color-ink)) 0 6px, transparent 6px 11px)',
        }}
      />
      {actions && <span className="flex shrink-0 items-center gap-1.5">{actions}</span>}
    </div>
  )
}
