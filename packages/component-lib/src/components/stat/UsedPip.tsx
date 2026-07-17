import { cn } from '../../utils/cn'

type UsedPipProps = {
  /** Whether this detail resource has been spent (once-per-rest). */
  used: boolean
  /**
   * Toggle handler. Present ⇒ ALWAYS-LIVE (like a VitalGauge — togglable without
   * any edit mode). Omit for a read-only pip: it shows the state statically.
   */
  onToggle?: (next: boolean) => void
  /** The cell's label segment — default "Used". */
  label?: string
  /** Accessible subject, e.g. the field / ability name. */
  subject?: string
  className?: string
}

// The PIP sits in the value cell: empty = a dashed off-white cell (whitespace =
// fillable), used = a solid accent-toned cell (`--tone` on a sheet, else rust).
const PIP = 'inline-block size-3.5 rounded-pip border-chrome transition-colors'
const PIP_EMPTY = 'border-dashed border-ink/40 bg-paper'
const PIP_FILLED = 'border-[color:var(--tone,var(--color-rust))] bg-[var(--tone,var(--color-rust))]'

/** The compact-Stat cell: black `[label]` segment + a value segment holding the pip. */
function UsedCell({ used, label }: { used: boolean; label: string }) {
  return (
    <span className="inline-flex w-fit items-stretch overflow-hidden rounded-badge border border-ink">
      <span className="flex items-center bg-ink px-1.5 font-cond text-badge font-bold uppercase leading-none tracking-caps text-paper">
        {label}
      </span>
      <span className="flex items-center bg-paper px-1.5 py-1">
        <span className={cn(PIP, used ? PIP_FILLED : PIP_EMPTY)} />
      </span>
    </span>
  )
}

/**
 * UsedPip — the once-per-rest "detail resource used" marker as a LABELLED
 * colored compact Stat: a black `[Used]` label segment beside a pip value cell
 * (empty whitespace at rest; interacting fills it with the accent). Always-live
 * when `onToggle` is supplied (no edit mode); read-only renders it static.
 */
export function UsedPip({ used, onToggle, label = 'Used', subject, className }: UsedPipProps) {
  const a11y = `${subject ?? label}`
  if (!onToggle) {
    return (
      <span role="img" aria-label={`${a11y} ${used ? 'used' : 'unused'}`} className={className}>
        <UsedCell used={used} label={label} />
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={used}
      aria-label={used ? `Mark ${a11y} unused` : `Mark ${a11y} used`}
      onClick={() => onToggle(!used)}
      className={cn(
        'inline-flex min-h-6 cursor-pointer items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        className
      )}
    >
      <UsedCell used={used} label={label} />
    </button>
  )
}
