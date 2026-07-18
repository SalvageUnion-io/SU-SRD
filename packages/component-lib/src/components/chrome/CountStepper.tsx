import { cn } from '../../utils/cn'
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
export function CountStepper({ count, onChange, subject, min = 0, max, label }: CountStepperProps) {
  const atMin = count <= min
  const atMax = max !== undefined && count >= max
  const readout = label !== undefined && max !== undefined ? `${label} ${count}/${max}` : `${count}`
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-[5px] border-2 border-ink leading-none">
      <StepButton
        aria-label={`Remove one ${subject}`}
        disabled={atMin}
        onClick={(e) => {
          e.stopPropagation()
          onChange(count - 1)
        }}
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
          'grid place-items-center bg-paper font-cond text-[13px] font-bold uppercase leading-none text-ink',
          label !== undefined ? 'min-w-[4.5rem] px-1.5 tabular-nums' : 'w-8',
          count === 0 && 'opacity-55'
        )}
      >
        {readout}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {subject} count: {count}
      </span>
      <StepButton
        aria-label={`Add one ${subject}`}
        disabled={atMax}
        onClick={(e) => {
          e.stopPropagation()
          onChange(count + 1)
        }}
        className="rounded-none border-0 bg-ink text-paper hover:bg-ink-2"
      >
        +
      </StepButton>
    </span>
  )
}
