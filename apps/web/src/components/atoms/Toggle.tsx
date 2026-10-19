import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { buttonVariants } from './buttonVariants'

/**
 * Toggle — one on/off (chrome K10, hard rule R29): a `Button` at its line's
 * Size that stays pressed, `aria-pressed` carrying the state, pressed the ink
 * plate (a state, never rust: ruleset §3.1). An NPC's Actions, a reactor's
 * Shut down.
 *
 * `variant="pencil"` is the one on/off on an editable sheet line (dashed means
 * editable, ruleset §3.9): a pilot's Mark used. Its words never change, so a
 * line's shape stays put; pressed, the pencil plate inverts to ink
 * (`.su-btn--pencil[aria-pressed]`). An optional leading `glyph` (the used
 * pip) carries the state beside the words.
 *
 * One control, one job. A row of options that sets a value (one of them, or a
 * set of them: a filter, a deck's effects) is a `Segmented`; a row that
 * switches what a region shows is `Tabs`. A Toggle stands alone.
 */
export function Toggle({
  pressed,
  size = 'compact',
  variant,
  glyph,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'aria-pressed'> & {
  pressed: boolean
  /** The Size (`styles/sizing.ts`) of the line it sits on. */
  size?: 'mini' | 'compact' | 'full'
  /** `pencil` on an editable sheet line; the default plate elsewhere. */
  variant?: 'pencil'
  /** A leading decorative glyph (the used pip), `aria-hidden` before the words. */
  glyph?: ReactNode
  children: ReactNode
}) {
  const look = variant ?? (pressed ? 'ink' : 'default')
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(buttonVariants({ variant: look, size }), className)}
      {...rest}
    >
      {glyph != null && <span aria-hidden="true">{glyph}</span>}
      {children}
    </button>
  )
}
