/**
 * SoftWarningBanner — advisory non-blocking strip for soft-warning display.
 *
 * Renders nothing when `warnings` is empty (zero DOM footprint).
 * When warnings are present, renders each warning with an icon, message, and
 * severity-based colour, plus "Save anyway" and "Fix it" action buttons.
 *
 * This is a controlled, dumb component — all state lives in the caller
 * (typically useSoftWarnings). It never calls entityStore directly.
 *
 * Wire-in note: Not wired into mech/pilot/crawler edit views in Wave 4.
 * That is deferred to Wave 5 polish (see cycle-3.md).
 */

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import type { SoftWarning, SoftWarningSeverity } from '../../lib/rules/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SoftWarningBannerProps = {
  warnings: SoftWarning[]
  onSaveAnyway: () => void
  onFixIt: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const SEVERITY_STRIP: Record<SoftWarningSeverity, string> = {
  info: 'border-blue-400 bg-blue-50 text-blue-900',
  warn: 'border-yellow-400 bg-yellow-50 text-yellow-900',
}

const SEVERITY_ICON: Record<SoftWarningSeverity, string> = {
  info: 'ℹ',
  warn: '⚠',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SoftWarningBanner({
  warnings,
  onSaveAnyway,
  onFixIt,
  className,
}: SoftWarningBannerProps) {
  if (warnings.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn('rounded border px-4 py-3 text-sm', className)}
    >
      <ul className="mb-3 space-y-1">
        {warnings.map((w) => (
          <li
            key={w.code}
            className={cn(
              'flex items-start gap-2 rounded border px-3 py-2',
              SEVERITY_STRIP[w.severity]
            )}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-base leading-none">
              {SEVERITY_ICON[w.severity]}
            </span>
            <span>{w.message}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onSaveAnyway}>
          Save anyway
        </Button>
        <Button variant="ghost" size="sm" onClick={onFixIt}>
          Fix it
        </Button>
      </div>
    </div>
  )
}
