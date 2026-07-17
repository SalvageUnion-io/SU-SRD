import { Btn } from '../chrome/Btn'
import { cn } from '../../utils/cn'

/**
 * SoftWarningBanner — advisory, non-blocking soft-warning strip (lifted from ITUN,
 * pending review — overlaps `Banner`; a merge is a later migration decision).
 *
 * Renders nothing when `warnings` is empty. A controlled, dumb component — all
 * state lives in the caller. Omit BOTH actions for the passive pre-save variant
 * (warnings render purely as information; the caller's own CTA proceeds).
 */

/** Soft-warning severity — mirrors ITUN's rules vocabulary structurally. */
export type SoftWarningSeverity = 'info' | 'warn'

/** A single advisory warning (structural — ITUN passes its rules `SoftWarning`). */
export type SoftWarning = {
  code: string
  severity: SoftWarningSeverity
  message: string
}

type SoftWarningBannerProps = {
  warnings: SoftWarning[]
  onSaveAnyway?: () => void
  onFixIt?: () => void
  className?: string
}

const SEVERITY_STRIP: Record<SoftWarningSeverity, string> = {
  info: 'border-su-blue bg-su-blue-pale text-su-black',
  warn: 'border-roll-failure bg-su-sickly-yellow/20 text-su-black',
}

const SEVERITY_ICON: Record<SoftWarningSeverity, string> = {
  info: 'ℹ',
  warn: '⚠',
}

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
