import { cn } from '../../utils/cn'
import { Button } from './Button'
import { capsLabel } from './capsLabel'
import { StepButton } from './SmallButtons'

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
}

/**
 * CountStepper — the `[− n +]` duplicate-quantity control (design mockup `.ctr`).
 * A bounded `−`/readout/`+` cluster: the two `StepButton`s are the operable
 * controls (each with its own accessible name), the readout is `aria-hidden`,
 * and the value is announced via an sr-only `role="status"` live region.
 *
 * Rides an entity card's controls overlay as a `stepper` control — clicks
 * `stopPropagation` so a step never bubbles to a surrounding card toggle.
 * Formerly baked into `SelCard`; now a standalone atom so any card (picker
 * cell, install row) reuses it.
 */
export function CountStepper({
  count,
  onChange,
  subject,
  min = 0,
  max,
  label,
  surface = 'sheet',
}: CountStepperProps) {
  const atMin = count <= min
  const atMax = max !== undefined && count >= max
  const readout = label !== undefined && max !== undefined ? `${label} ${count}/${max}` : `${count}`
  const step = (next: number) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onChange(next)
  }
  /** Announced separately from the aria-hidden readout, in both surfaces. */
  const liveRegion = (
    <span role="status" aria-live="polite" className="sr-only">
      {subject} count: {count}
    </span>
  )

  if (surface === 'instrument') {
    // The dashboard overlay cluster (formerly the separate DamageStepper):
    // spaced buttons, no joining border, and a large tabular readout.
    return (
      <div className="flex items-center justify-center gap-[10px]">
        <Button
          size="compact"
          className="min-w-0 px-2"
          aria-label={`Remove one ${subject}`}
          disabled={atMin}
          onClick={step(count - 1)}
        >
          −
        </Button>
        <span
          aria-hidden="true"
          className="min-w-[44px] text-center font-cond text-title font-bold tabular-nums text-ink"
        >
          {readout}
        </span>
        {liveRegion}
        <Button
          size="compact"
          className="min-w-0 px-2"
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
    <span className="inline-flex items-stretch overflow-hidden rounded-card border-2 border-ink leading-none">
      <StepButton
        aria-label={`Remove one ${subject}`}
        disabled={atMin}
        onClick={step(count - 1)}
        className="rounded-none border-0 bg-ink text-paper hover:bg-ink-2"
      >
        −
      </StepButton>
      {/* Plain readout, not role="spinbutton" — a spinbutton must be focusable +
          arrow-operable, which a static span is not. The value is announced via
          the sr-only live region below; the ± buttons stay the operable controls. */}
      <span
        aria-hidden="true"
        className={cn(
          capsLabel({ size: 'caption', tracking: 'inherit' }),
          'grid place-items-center bg-paper leading-none text-ink',
          label !== undefined ? 'min-w-[4.5rem] px-1.5 tabular-nums' : 'w-8',
          count === 0 && 'opacity-55'
        )}
      >
        {readout}
      </span>
      {liveRegion}
      <StepButton
        aria-label={`Add one ${subject}`}
        disabled={atMax}
        onClick={step(count + 1)}
        className="rounded-none border-0 bg-ink text-paper hover:bg-ink-2"
      >
        +
      </StepButton>
    </span>
  )
}
