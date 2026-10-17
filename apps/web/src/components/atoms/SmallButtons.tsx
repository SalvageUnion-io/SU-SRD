import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { font, fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { DISABLED, FOCUS_RING } from './interaction'

type StepButtonProps = ComponentPropsWithRef<'button'> & {
  /**
   * The ground the button sits on, which picks its plate: on `paper` it is the
   * ink block with a paper glyph (CountStepper's pill); on `ink` it inverts to
   * a paper block with an ink glyph (an inverse `Stat`).
   */
  ground?: 'paper' | 'ink'
  /**
   * `square` (default) is the 24×24 button; `cell` takes the height of the
   * cell it stands beside (an editable `Stat`), its width from the caller.
   */
  fit?: 'square' | 'cell'
}

/**
 * The static type and alignment. The plate, radius and tap floor stay in
 * `.su-step-btn` (`styles/index.css`): the plate has a hover, the tap floor a
 * breakpoint, and an inline style would outrank both.
 */
const STEP_BUTTON = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  justifyContent: 'center',
  lineHeight: 1,
} satisfies CSSProperties

const SQUARE = { ...STEP_BUTTON, height: space[24], width: space[24] } satisfies CSSProperties

const GROUND = { paper: 'su-step-btn--on-paper', ink: 'su-step-btn--on-ink' } as const

/**
 * The one +/− stepper button (design-spec §2.10 `stepbtn`): CountStepper's
 * pill and an editable `Stat` both draw it. `square` stays visually 24px on
 * desktop; `.su-step-btn` grows the tap area to the 44px touch minimum below
 * `sm` without changing the desktop layout.
 * The accessible name comes from the caller (pass an `aria-label`).
 */
export function StepButton({
  className,
  style,
  type = 'button',
  ground = 'paper',
  fit = 'square',
  ref,
  ...props
}: StepButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'su-step-btn',
        GROUND[ground],
        fit === 'cell' && 'su-step-btn--cell su-stat-step',
        FOCUS_RING,
        DISABLED,
        className
      )}
      style={{ ...(fit === 'square' ? SQUARE : STEP_BUTTON), ...style }}
      {...props}
    />
  )
}
