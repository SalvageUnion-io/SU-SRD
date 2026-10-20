import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * TOGGLE CARD — one on/off whose face is a card the host draws (a choice's
 * option: its name over its text), the look no `Button` Size draws (hard rule
 * R16). `aria-pressed` carries the state; the host dims an unchosen one with
 * the one select dim (`SELECT_DIM`, R15) and seals a chosen one at level 1.
 */
export function ToggleCard({
  pressed,
  className,
  children,
  ...button
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'aria-pressed'> & { pressed: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} className={cn(FOCUS_RING, className)} {...button}>
      {children}
    </button>
  )
}
