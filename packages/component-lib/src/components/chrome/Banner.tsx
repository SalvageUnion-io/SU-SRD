import { cn } from '../../utils/cn'

export type BannerSeverity = 'info' | 'warn'

/**
 * A single advisory row. The shape is defined locally — Banner never depends on
 * ITUN's rules types; consumers map their own warnings onto `{ severity, message }`.
 */
export type BannerWarning = {
  severity: BannerSeverity
  message: string
}

type BannerProps = {
  /** The advisory rows. When empty, the Banner renders nothing (zero DOM). */
  warnings: BannerWarning[]
  className?: string
}

/**
 * Per-severity pill tone. `info` = the cool blue-pale advisory; `warn` = the
 * sickly-yellow caution keyed to the warn state tone. Both keep ink text —
 * these are advisory strips, never the rust action colour.
 */
const SEVERITY_PILL: Record<BannerSeverity, string> = {
  info: 'border-wk-line bg-wk-bg text-ink',
  warn: 'border-status-warn bg-caution/25 text-ink',
}

const SEVERITY_ICON: Record<BannerSeverity, string> = {
  info: 'ℹ',
  warn: '⚠',
}

/**
 * Banner — the advisory, NON-BLOCKING soft-warning strip.
 *
 * `role="alert"` + `aria-live="polite"` announces newly-surfaced advice without
 * stealing focus. Renders nothing when `warnings` is empty. Otherwise a `ul` of
 * severity-toned pills (icon + message) — the rows are purely informational and
 * the surrounding flow proceeds regardless; this strip never blocks.
 *
 * Grounded on ITUN's `SoftWarningBanner`, re-implemented on the shared atoms.
 */
export function Banner({ warnings, className }: BannerProps) {
  if (warnings.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn('font-body text-caption text-ink', className)}
    >
      <ul className="flex flex-col gap-1.5">
        {warnings.map((warning, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings carry no id and may repeat a severity; severity+index is the stablest available key
            key={`${warning.severity}-${index}`}
            className={cn(
              'flex items-start gap-2 rounded-card border-chrome px-3 py-2',
              SEVERITY_PILL[warning.severity]
            )}
          >
            <span aria-hidden="true" className="mt-px shrink-0 text-base leading-none">
              {SEVERITY_ICON[warning.severity]}
            </span>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
