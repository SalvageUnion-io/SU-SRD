// A wizard's budgets: `WizTracker` in the action bar, `WizMeter` on the step.
import { Stat, slotPips } from '../../components/index'

/**
 * A wizard budget in the action pill (`SCRAP | 20/20`): the `Stat` cell, its
 * value read against its cap. `pips` leads the reading with one pip a slot
 * (`slotPips`). Its value is the caller's: the tracker does no budget math.
 */
export function WizTracker({
  label,
  value,
  max,
  pips = false,
  testId,
}: {
  label: string
  value: number
  max: number
  pips?: boolean
  /** The reading's test hook. */
  testId?: string
}) {
  return (
    <span data-testid={testId}>
      <Stat label={label} value={pips ? `${slotPips(value, max)}${value}` : value} max={max} />
    </span>
  )
}

/**
 * A budget as a meter, on the step it is spent on: the reading (`WizTracker`'s
 * `Stat`) and one small cell a point beside it, the filled cells the number it
 * reads (the Scrap still held, the slots filled). The cells repeat the reading
 * for the eye, so a screen reader hears the `Stat` alone.
 */
export function WizMeter({ label, value, max }: { label: string; value: number; max: number }) {
  const cells = Array.from({ length: Math.max(0, max) }, (_, index) => index)
  return (
    <span className="su-wiz-meter">
      <Stat label={label} value={value} max={max} />
      <span aria-hidden="true" className="su-wiz-meter__cells">
        {cells.map((index) => (
          <span key={index} data-filled={index < value || undefined} />
        ))}
      </span>
    </span>
  )
}
