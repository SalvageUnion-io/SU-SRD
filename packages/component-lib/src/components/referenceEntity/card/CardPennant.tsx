import type { CSSProperties } from 'react'
import { font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { cn } from '../../../utils/cn'
import { buttonVariants } from '../../chrome/buttonVariants'
import { FOCUS_RING } from '../../chrome/interaction'
import type { CardSize } from '../../shared/displayMode'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/** The book's pennant: a box with a pointed tail. Hard edges, no tail rounding. */
const PENNANT_SHAPE = 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)'

const TYPE: Record<CardSize, string> = {
  large: fontSize.caption,
  medium: fontSize.xs,
  small: fontSize.badge,
}

const pennantType = (size: CardSize): CSSProperties => ({
  clipPath: PENNANT_SHAPE,
  fontFamily: font.cond,
  fontSize: TYPE[size],
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  padding: `${space[2]} ${space[14]} ${space[2]} ${space[6]}`,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
})

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
    return (
      <span
        style={{
          ...pennantType(size),
          backgroundColor: 'var(--color-paper)',
          color: 'var(--color-ink)',
          flex: 'none',
        }}
      >
        {label}
      </span>
    )
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
        className={buttonVariants({ variant: 'primary', size: 'mini' })}
        style={{ ...pennantType(size), borderRadius: 0, borderWidth: 0 }}
      >
        {label}
      </span>
    </button>
  )
}
