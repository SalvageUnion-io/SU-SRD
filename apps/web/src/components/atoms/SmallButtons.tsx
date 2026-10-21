import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { font, fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { DISABLED, FOCUS_RING } from './interaction'

type StepButtonProps = ComponentPropsWithRef<'button'> & {
  /**
   * `square` (default) is the 24×24 button; `cell` takes the height of the
   * cell it stands beside (an editable `Stat`), its width from the caller.
   */
  fit?: 'square' | 'cell'
}

/**
 * The static type and alignment. The plate, radius and tap floor stay in
 * `.su-step-btn` (`styles/partials/atoms-badges.css`): the plate has a hover, the tap floor a
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

/**
 * The one +/− stepper button (design-spec §2.10 `stepbtn`): an editable
 * `Stat` and `VitalGauge`'s `steppers` draw it, and nothing else does (hard
 * rule R12, Biome's `noRestrictedImports`). Its plate is the ink block with a
 * paper glyph; on an ink ground (the frame's `data-ground`, chrome K1) it
 * inverts to a paper block with an ink glyph, in CSS. `square` stays visually 24px on
 * desktop; `.su-step-btn` grows the tap area to the 44px touch minimum below
 * `sm` without changing the desktop layout.
 * The accessible name comes from the caller (pass an `aria-label`).
 */
export function StepButton({
  className,
  style,
  type = 'button',
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
