import type { CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { Button } from './Button'
import { capsLabel } from './capsLabel'
import { StepButton } from './SmallButtons'

/** The joined `[− n +]` ink pill (the `sheet` surface). */
const PILL = {
  alignItems: 'stretch',
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  display: 'inline-flex',
  lineHeight: 1,
  overflow: 'hidden',
} satisfies CSSProperties

/** The pill's readout cell; a labelled readout widens to fit "Uses 3/5". */
const PILL_READOUT = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'grid',
  lineHeight: 1,
  placeItems: 'center',
} satisfies CSSProperties

const PILL_READOUT_LABELLED = {
  fontVariantNumeric: 'tabular-nums',
  minWidth: '4.5rem',
  paddingInline: space[6],
} satisfies CSSProperties

const PILL_READOUT_BARE = { width: space[32] } satisfies CSSProperties

/** The `instrument` cluster: spaced buttons around a large tabular readout. */
const CLUSTER = {
  alignItems: 'center',
  display: 'flex',
  gap: space[10],
  justifyContent: 'center',
} satisfies CSSProperties

const CLUSTER_READOUT = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: weight.bold,
  minWidth: '44px',
  textAlign: 'center',
} satisfies CSSProperties

type CountStepperProps = {
  /** Current count. */
  count: number
  /** Emit the next count (already clamped by the caller's budget). */
  onChange: (next: number) => void
  /** Subject noun for the accessible labels, e.g. the entity name → the `−`/`+`
   *  buttons read "Remove one {subject}" / "Add one {subject}" and an sr-only
   *  live region announces "{subject} count: {n}". */
  subject: string
  /** Floor (default 0); `−` disables at it. */
  min?: number
  /** Ceiling given the shared budget; `+` disables at it. */
  max?: number
  /** Optional readout prefix — with `max` set, the readout reads
   *  "{label} {count}/{max}" (e.g. "Uses 3/5") instead of the bare count. */
  label?: string
  /**
   * Surface skin, mirroring `VitalGauge`'s `surface` (RenderingMatrix
   * `skin sheet|instrument`): `sheet` (default) is the joined `[− n +]` ink
   * pill that rides an entity card's controls overlay; `instrument` is the
   * dashboard overlay's loose cluster — spaced `Button`s flanking a large
   * 24px tabular readout. Same control, same a11y contract, two grounds.
   */
  surface?: 'sheet' | 'instrument'
  /** Both buttons off, the readout still shown: a surface that cannot write now. */
  disabled?: boolean
}

/**
 * CountStepper — the `[− n +]` duplicate-quantity control (design mockup `.ctr`).
 * A bounded `−`/readout/`+` cluster: the two `StepButton`s are the operable
 * controls (each with its own accessible name), the readout is `aria-hidden`,
 * and the value is announced via an sr-only `role="status"` live region.
 *
 * Rides an entity card's controls overlay as a `stepper` control — clicks
 * `stopPropagation` so a step never bubbles to a surrounding card toggle.
 * A standalone atom, so any card (picker cell, install row) reuses it.
 */
export function CountStepper({
  count,
  onChange,
  subject,
  min = 0,
  max,
  label,
  surface = 'sheet',
  disabled = false,
}: CountStepperProps) {
  const atMin = disabled || count <= min
  const atMax = disabled || (max !== undefined && count >= max)
  const readout = label !== undefined && max !== undefined ? `${label} ${count}/${max}` : `${count}`
  const step = (next: number) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onChange(next)
  }
  /** Announced separately from the aria-hidden readout, in both surfaces. */
  const liveRegion = (
    <span role="status" aria-live="polite" className="su-sr-only">
      {subject} count: {count}
    </span>
  )

  if (surface === 'instrument') {
    // The dashboard overlay cluster:
    // spaced buttons, no joining border, and a large tabular readout.
    return (
      <div style={CLUSTER}>
        <Button
          size="compact"
          className="su-count-stepper__btn"
          aria-label={`Remove one ${subject}`}
          disabled={atMin}
          onClick={step(count - 1)}
        >
          −
        </Button>
        <span aria-hidden="true" style={CLUSTER_READOUT}>
          {readout}
        </span>
        {liveRegion}
        <Button
          size="compact"
          className="su-count-stepper__btn"
          aria-label={`Add one ${subject}`}
          disabled={atMax}
          onClick={step(count + 1)}
        >
          +
        </Button>
      </div>
    )
  }

  return (
    <span style={PILL}>
      <StepButton
        aria-label={`Remove one ${subject}`}
        disabled={atMin}
        onClick={step(count - 1)}
        className="su-count-stepper__step"
      >
        −
      </StepButton>
      {/* Plain readout, not role="spinbutton" — a spinbutton must be focusable +
          arrow-operable, which a static span is not. The value is announced via
          the sr-only live region below; the ± buttons stay the operable controls. */}
      <span
        aria-hidden="true"
        className={capsLabel({ size: 'caption', tracking: 'inherit' })}
        style={{
          ...PILL_READOUT,
          ...(label !== undefined ? PILL_READOUT_LABELLED : PILL_READOUT_BARE),
          ...(count === 0 ? { opacity: 0.55 } : undefined),
        }}
      >
        {readout}
      </span>
      {liveRegion}
      <StepButton
        aria-label={`Add one ${subject}`}
        disabled={atMax}
        onClick={step(count + 1)}
        className="su-count-stepper__step"
      >
        +
      </StepButton>
    </span>
  )
}
