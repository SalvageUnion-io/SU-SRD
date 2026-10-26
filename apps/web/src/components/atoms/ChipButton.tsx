import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * CHIP BUTTON — a chip that is itself the control: the look no `Button` Size
 * draws (hard rule R16), a `Stat` chip at its siblings' height (R12),
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
    <button type="button" className={cn('su-chip-link', FOCUS_RING, className)} {...button}>
      {children}
    </button>
  )
}
