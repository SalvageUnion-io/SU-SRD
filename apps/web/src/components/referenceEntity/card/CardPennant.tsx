import { cn } from '../../../lib/cn'
import { buttonVariants } from '../../atoms/buttonVariants'
import { FOCUS_RING } from '../../atoms/interaction'
import type { CardSize } from '../../containers/displayMode'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * The pennant's cut, caps face and size are `.su-pennant` classes
 * (`styles/index.css`), not a style object: every action on a page carries one
 * (ADR-046, repeated elements). Its shape is `PENNANT_SHAPE` (`cardChrome.ts`),
 * which the link preview (`OgCard`) also cuts.
 */
const pennantClass = (size: CardSize) => `su-pennant su-pennant--${size}`

/**
 * The COST PENNANT at the right of an ink banner (ruleset §5, board E1).
 *
 * Read-only it is a paper pennant on the ink. In the Dashboard it IS the
 * action button (ruleset §1, board E3): the same size, shape and place, filled
 * rust — the fill comes from `buttonVariants`, the one place rust is painted
 * (§3.1) — inside an invisible 44px hit area, so the pennant stays the size the
 * book draws while the target meets the touch floor (§4.6). There is no
 * separate deck button.
 */
export function CardPennant({
  cost,
  size,
  control,
  subject,
}: {
  /** The cost as printed ("2 AP"). Without one the pennant reads the
   * control's label (an action that costs nothing still resolves). */
  cost: string | undefined
  size: CardSize
  /** The `pennant` control that resolves the action, when this card is in play. */
  control?: ReferenceEntityControl
  /** The action's name, for the button's accessible name. */
  subject: string
}) {
  const verb = control?.label ?? 'Use'
  const label = cost ?? verb
  // The accessible name says what the tap does and carries the visible text
  // (WCAG 2.5.3): "Activate Auger, spend 1 EP".
  const name = control?.ariaLabel ?? `${verb} ${subject}${cost ? `, spend ${cost}` : ''}`
  if (!control?.onClick) {
    return <span className={cn(pennantClass(size), 'su-pennant--read')}>{label}</span>
  }
  return (
    <button
      type="button"
      className={cn('su-ec-pennant-btn', FOCUS_RING)}
      onClick={(event) => {
        // A pennant on a clickable card must not also fire the card.
        event.stopPropagation()
        control.onClick?.()
      }}
      disabled={control.disabled}
      aria-label={name}
      title={control.title ?? name}
    >
      <span
        className={cn(
          buttonVariants({ variant: 'primary', size: 'mini' }),
          pennantClass(size),
          'su-pennant--button'
        )}
      >
        {label}
      </span>
    </button>
  )
}
