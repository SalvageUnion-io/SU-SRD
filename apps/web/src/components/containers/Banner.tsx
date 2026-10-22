import type { CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'

type BannerSeverity = 'info' | 'warn'

/**
 * A single advisory row. The shape is defined locally — Banner never depends on
 * the app's rules types; consumers map their own warnings onto `{ severity, message }`.
 */
export type BannerWarning = {
  severity: BannerSeverity
  message: string
}

type BannerProps = {
  /** The advisory rows. When empty, the Banner renders nothing (zero DOM). */
  warnings: BannerWarning[]
}

/**
 * Per-severity pill tone. `info` = the cool blue-pale advisory; `warn` = the
 * sickly-yellow caution keyed to the warn state tone. Both keep ink text —
 * these are advisory strips, never the rust action colour.
 */
const SEVERITY_PILL: Record<BannerSeverity, CSSProperties> = {
  info: { borderColor: color.wkLine, backgroundColor: color.wkBg, color: color.ink },
  warn: { borderColor: color.statusWarn, backgroundColor: color.caution25, color: color.ink },
}

const ROOT = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
} satisfies CSSProperties

const LIST = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

const PILL = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: space[8],
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  padding: `${space[8]} ${space[12]}`,
} satisfies CSSProperties

const ICON = {
  marginTop: space[2],
  flexShrink: 0,
  fontSize: fontSize.base,
  lineHeight: 1,
} satisfies CSSProperties

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
 * Grounded on the app's `SoftWarningBanner`, re-implemented on the shared atoms.
 */
export function Banner({ warnings }: BannerProps) {
  if (warnings.length === 0) return null

  return (
    <div role="alert" aria-live="polite" style={ROOT}>
      <ul style={LIST}>
        {warnings.map((warning, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings carry no id and may repeat a severity; severity+index is the stablest available key
            key={`${warning.severity}-${index}`}
            style={{ ...PILL, ...SEVERITY_PILL[warning.severity] }}
          >
            <span aria-hidden="true" style={ICON}>
              {SEVERITY_ICON[warning.severity]}
            </span>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
