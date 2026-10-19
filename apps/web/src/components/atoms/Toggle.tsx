import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { buttonVariants } from './buttonVariants'

/**
 * Toggle — one on/off (chrome K10, hard rule R29): a `Button` at its line's
 * Size that stays pressed, `aria-pressed` carrying the state, pressed the ink
 * plate (a state, never rust: ruleset §3.1). An NPC's Actions, a reactor's
 * Shut down.
 *
 * One control, one job. A row of options that sets a value (one of them, or a
 * set of them: a filter, a deck's effects) is a `Segmented`; a row that
 * switches what a region shows is `Tabs`. A Toggle stands alone.
 */
export function Toggle({
  pressed,
  size = 'compact',
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'aria-pressed'> & {
  pressed: boolean
  /** The Size (`styles/sizing.ts`) of the line it sits on. */
  size?: 'mini' | 'compact' | 'full'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(buttonVariants({ variant: pressed ? 'ink' : 'default', size }), className)}
      {...rest}
    >
      {children}
    </button>
  )
}
