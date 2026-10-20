import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * TRACK STEP — one step on a numbered track that the host lets the reader move
 * to: the look no `Button` Size draws (hard rule R16), a numbered tab whose
 * face is its track's (a wizard's step rail, Play's Downtime track), never a
 * Button's frame, caps or fade. It says where the track stands through the
 * host's `aria-current`; a step the reader may not move to is `disabled`.
 */
export function TrackStep({
  className,
  children,
  ...button
}: Omit<ComponentPropsWithRef<'button'>, 'type'>) {
  return (
    <button type="button" className={cn(FOCUS_RING, className)} {...button}>
      {children}
    </button>
  )
}
