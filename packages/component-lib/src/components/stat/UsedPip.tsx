import { cn } from '../../utils/cn'

type UsedPipProps = {
  /** Whether this detail resource has been spent (once-per-rest). */
  used: boolean
  /**
   * Toggle handler. Present ⇒ ALWAYS-LIVE (like a VitalGauge — togglable without
   * any edit mode). Omit for a read-only pip (published snapshots): it shows the
   * state statically and never toggles.
   */
  onToggle?: (next: boolean) => void
  /** Pill text — default "Used". */
  label?: string
  /** Accessible subject for the toggle label, e.g. the ability name. */
  subject?: string
  className?: string
}

// Matches our Stat cell styling: `rounded-badge` + 1px border (not a rounded-full
// pill), ink-filled when ON like a stat's label segment.
const BASE =
  'inline-flex min-h-6 items-center gap-1.5 rounded-badge border px-2 py-1 font-cond text-badge font-bold uppercase leading-none tracking-caps'

/** The leading dot — filled with the sheet accent (`--tone`, else rust) when used. */
function Dot({ used }: { used: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-2.5 w-2.5 shrink-0 rounded-full border-2',
        used
          ? 'border-[color:var(--tone,var(--color-rust))] bg-[var(--tone,var(--color-rust))]'
          : 'border-current'
      )}
    />
  )
}

/**
 * UsedPip — the once-per-rest "detail resource used" indicator (design: the
 * `● USED` pill). ON = ink pill + accent dot + paper text; OFF = a muted outline
 * with a hollow dot. Always-live when `onToggle` is supplied (no edit mode);
 * read-only (no handler) renders the state as a static pill.
 */
export function UsedPip({ used, onToggle, label = 'Used', subject, className }: UsedPipProps) {
  const onClasses = 'border-ink bg-ink text-paper'
  if (!onToggle) {
    return (
      <span className={cn(BASE, used ? onClasses : 'border-ink/40 text-ink/50', className)}>
        <Dot used={used} />
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={used}
      aria-label={used ? `Mark ${subject ?? label} unused` : `Mark ${subject ?? label} used`}
      onClick={() => onToggle(!used)}
      className={cn(
        BASE,
        'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        used ? onClasses : 'border-ink/40 bg-paper text-ink/50 hover:border-ink hover:text-ink',
        className
      )}
    >
      <Dot used={used} />
      {label}
    </button>
  )
}
