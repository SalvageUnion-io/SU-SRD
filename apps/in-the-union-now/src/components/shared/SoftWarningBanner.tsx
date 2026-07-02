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

import { Btn } from 'suref-react'

import { cn } from '../../lib/utils'
import type { SoftWarning, SoftWarningSeverity } from '../../lib/rules/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SoftWarningBannerProps = {
  warnings: SoftWarning[]
  /**
   * Optional confirm-and-proceed actions. Omit BOTH for the passive pre-save
   * variant (wizard Review step): warnings render purely as information and
   * the wizard's own CTA proceeds regardless — never blocking (plan 3.4).
   */
  onSaveAnyway?: () => void
  onFixIt?: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const SEVERITY_STRIP: Record<SoftWarningSeverity, string> = {
  info: 'border-su-blue bg-su-blue-pale text-su-black',
  warn: 'border-roll-failure bg-su-sickly-yellow/20 text-su-black',
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
    <div role="alert" aria-live="polite" className={cn('px-4 py-3 text-sm', className)}>
      <ul className={cn('space-y-1', (onSaveAnyway || onFixIt) && 'mb-3')}>
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

      {(onSaveAnyway || onFixIt) && (
        <div className="flex gap-2">
          {onSaveAnyway && (
            <Btn size="sm" onClick={onSaveAnyway}>
              Save anyway
            </Btn>
          )}
          {onFixIt && (
            <Btn variant="ghost" size="sm" onClick={onFixIt}>
              Fix it
            </Btn>
          )}
        </div>
      )}
    </div>
  )
}
