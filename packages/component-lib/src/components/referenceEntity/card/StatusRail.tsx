import type { CSSProperties } from 'react'
import { font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { Button } from '../../chrome/Button'
import type { CardSize } from '../../shared/displayMode'
import type { EntityStatus } from '../../shared/entityStatus'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

const STATES: { value: EntityStatus; label: string }[] = [
  { value: 'intact', label: 'Intact' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'destroyed', label: 'Destroyed' },
]

const PAD_X: Record<CardSize, string> = { large: space[14], medium: space[10], small: space[8] }

/**
 * Each segment fills the 44px touch floor (ruleset §4.6) inside the 1.5px
 * dashed frame, so the control reads as tall as the Remove beside it (E3)
 * rather than a tab riding a rule.
 */
const segment = (active: boolean): CSSProperties => ({
  alignItems: 'center',
  backgroundColor: active ? 'var(--color-ink)' : 'var(--color-paper)',
  color: active ? 'var(--color-paper)' : 'var(--color-ink)',
  display: 'inline-flex',
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  minHeight: 'calc(44px - 2 * var(--bw-chrome))',
  padding: `0 ${space[8]}`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
})

/**
 * The condition as a TRI-STATE (board E3): Intact / Damaged / Destroyed in one
 * framed group, the current one inverted. State is a treatment, not a hue
 * (ruleset §3 law 3) — never the green and red the status badge wore. With a
 * handler the whole group is ONE 44px button that steps to the next state;
 * without one it is a read-only group.
 */
export function StatusTriState({
  status,
  onClick,
  subject,
}: {
  status: EntityStatus
  onClick: (() => void) | undefined
  subject: string
}) {
  const label = STATES.find((s) => s.value === status)?.label ?? status
  const group = (
    <span
      style={{
        // Dashed: the live sheet's controls are pencil, not print (E3).
        border: 'var(--bw-chrome) dashed var(--color-ink)',
        display: 'inline-flex',
      }}
    >
      {STATES.map((s) => (
        <span
          key={s.value}
          aria-current={s.value === status ? 'true' : undefined}
          style={segment(s.value === status)}
        >
          {s.label}
        </span>
      ))}
    </span>
  )
  if (!onClick) return <span title={`${subject}: ${label}`}>{group}</span>
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={`${subject} status: ${label} — click to change`}
      style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
    >
      {group}
    </button>
  )
}

/**
 * The LIVE-SHEET control rail (board E3): a dashed rail in the body, the
 * condition tri-state on the left and the rust Remove on the right. It is the
 * body's, not the seam's: the seam carries stamps, and a control that changes
 * what the card IS deserves a touch-sized target (ruleset §4.6), not a tab.
 */
export function StatusRail({
  status,
  onStatusClick,
  removers,
  subject,
  size,
}: {
  status: EntityStatus | undefined
  onStatusClick: (() => void) | undefined
  /** The destructive controls (`variant: 'danger'`), drawn as the rust Remove. */
  removers: ReferenceEntityControl[]
  subject: string
  size: CardSize
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        borderTop: 'var(--bw-chrome) dashed var(--color-ink-40)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: space[8],
        justifyContent: 'space-between',
        padding: `${space[8]} ${PAD_X[size]}`,
      }}
    >
      {status ? (
        <StatusTriState status={status} onClick={onStatusClick} subject={subject} />
      ) : (
        <span />
      )}
      {removers.map((control) => (
        <Button
          key={control.key}
          variant="primary"
          size="compact"
          disabled={control.disabled}
          aria-label={control.ariaLabel ?? control.label}
          title={control.title ?? control.ariaLabel}
          onClick={(event) => {
            event.stopPropagation()
            control.onClick?.()
          }}
          style={{
            fontFamily: font.cond,
            fontSize: fontSize.sm,
            fontWeight: weight.bold,
            letterSpacing: tracking.capsSnug,
            marginLeft: 'auto',
            // The 44px floor under every pointer, level with the tri-state (E3).
            minHeight: '44px',
            textTransform: 'uppercase',
          }}
        >
          {control.label ?? control.ariaLabel}
        </Button>
      ))}
    </div>
  )
}
