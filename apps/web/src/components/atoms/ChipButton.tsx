import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * CHIP BUTTON — a chip that is itself the control: the look no `Button` Size
 * draws (hard rule R16), a `Stat` chip at its siblings' height inside a 24px
 * target (WCAG 2.5.8; `.su-hit-area` carries it to 44px on a coarse pointer),
 * underlining its label on hover (`.su-chip-link`). A trait tag that opens its
 * entry's Page, and an unassigned seat's seal that picks the character up.
 * Its child is the chip (`Stat`); the host says what pressing it does.
 */
export function ChipButton({
  className,
  children,
  ...button
}: Omit<ComponentPropsWithRef<'button'>, 'type'>) {
  return (
    <button
      type="button"
      className={cn('su-chip-link su-hit-area', FOCUS_RING, className)}
      {...button}
    >
      {children}
    </button>
  )
}
