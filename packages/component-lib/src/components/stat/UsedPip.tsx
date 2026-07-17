import { cn } from '../../utils/cn'

type UsedPipProps = {
  /** Whether this detail resource has been spent (once-per-rest). */
  used: boolean
  /**
   * Toggle handler. Present ⇒ ALWAYS-LIVE (like a VitalGauge — togglable without
   * any edit mode). Omit for a read-only pip: it shows the state statically.
   */
  onToggle?: (next: boolean) => void
  /** Accessible subject, e.g. the field / ability name. */
  subject?: string
  className?: string
}

// A single addressable PIP in the shared pip-cell language (SlotGrid / gauge
// cells): empty = a dashed off-white cell (whitespace = fillable), used = a solid
// accent-toned cell. `--tone` on a sheet, else rust.
const CELL = 'inline-block size-5 shrink-0 rounded-badge border-chrome transition-colors'
const EMPTY = 'border-dashed border-ink/40 bg-paper'
const FILLED = 'border-[color:var(--tone,var(--color-rust))] bg-[var(--tone,var(--color-rust))]'

/**
 * UsedPip — the once-per-rest "detail resource used" marker as a single PIP: the
 * empty (whitespace) cell is the resting state; interacting fills it (used).
 * Always-live when `onToggle` is supplied (no edit mode); read-only (no handler)
 * renders the pip statically.
 */
export function UsedPip({ used, onToggle, subject, className }: UsedPipProps) {
  const stateCell = used ? FILLED : EMPTY
  if (!onToggle) {
    return (
      <span
        role="img"
        aria-label={`${subject ?? 'Resource'} ${used ? 'used' : 'unused'}`}
        className={cn(CELL, stateCell, className)}
      />
    )
  }
  return (
    <button
      type="button"
      aria-pressed={used}
      aria-label={
        used ? `Mark ${subject ?? 'resource'} unused` : `Mark ${subject ?? 'resource'} used`
      }
      onClick={() => onToggle(!used)}
      className={cn(
        'inline-flex min-h-6 cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        className
      )}
    >
      <span className={cn(CELL, stateCell, 'hover:border-ink')} />
    </button>
  )
}
