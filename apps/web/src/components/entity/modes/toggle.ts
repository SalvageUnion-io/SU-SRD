import type { HTMLAttributes } from 'react'
import { activateOnKey } from '../../atoms/interaction'

/**
 * The toggle Token's surface (EDL Modes: an in-card entity choice is a toggle
 * Token, pressed while chosen; Play's Mediator seats and Tables): a button
 * whose pressed state is the choice, named by what choosing does. The Token
 * and the roll table Token spread it on the element that stands where their
 * link would, so no control nests in it, and their parent marks it
 * (`data-choice-toggle`), the one Token the nesting gate lets take a pressed
 * state (N7). A plain element with the button role, as a link-mode opener is
 * (`LinkSurface`): a pill holds a Token's chips, which a `<button>` may not.
 */
export function toggleAttrs({
  pressed,
  onToggle,
  label,
}: {
  pressed: boolean
  onToggle: () => void
  label: string
}): HTMLAttributes<HTMLElement> {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-pressed': pressed,
    'aria-label': label,
    onClick: onToggle,
    onKeyDown: activateOnKey(onToggle),
    style: { cursor: 'pointer' },
  }
}
