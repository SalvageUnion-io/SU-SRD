import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { font, fontSize, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { DISABLED, FOCUS_RING } from './interaction'

type StepButtonProps = ComponentPropsWithRef<'button'>

/**
 * The static geometry and type. The ground, frame, radius and ink stay in
 * `.su-step-btn` (`styles/index.css`): the ground has a hover, the tap floor a
 * breakpoint, and `CountStepper` re-skins the frame and fill through
 * `className`, which an inline style would outrank.
 */
const STEP_BUTTON = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  height: space[24],
  justifyContent: 'center',
  lineHeight: 1,
  width: space[24],
} satisfies CSSProperties

/**
 * 24×24 stat stepper button (design-spec §2.10 `stepbtn`): '–'/'+' beside a
 * StatBlock value. Hovers to the sheet `--ground` when present. Stays visually
 * 24px square on desktop; `.su-step-btn` grows the tap area to the 44px touch
 * minimum below `sm` without changing the desktop layout.
 * The accessible name comes from the caller (pass an `aria-label`).
 */
export function StepButton({ className, style, type = 'button', ref, ...props }: StepButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('su-step-btn', FOCUS_RING, DISABLED, className)}
      style={{ ...STEP_BUTTON, ...style }}
      {...props}
    />
  )
}
