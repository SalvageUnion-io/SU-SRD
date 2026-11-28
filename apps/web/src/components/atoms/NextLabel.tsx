import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { iconSize } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'

/**
 * NextLabel — what a forward control says (chrome K11), the
 * mirror of `BackLabel`: the place's name ("Stats", "Step 3") and the
 * `ChevronRight` glyph after it at the line's Size, never an arrow character
 * or a sentence. Its accessible name reads "Next: <place>", the visible name
 * inside it (WCAG 2.5.3).
 *
 * Content, not a control: it goes inside the link or button that goes on.
 */
export function NextLabel({
  to,
  size = 'compact',
  wordClassName,
}: {
  /** The place's name. */
  to: ReactNode
  /** The Size of the line the control sits on. */
  size?: keyof typeof iconSize
  /**
   * A host's class on the word "Next:", for a control that shows it where it
   * has room (the wizard's, from `sm`). The one word is then seen and read:
   * never a second "Next:" beside it.
   */
  wordClassName?: string
}) {
  return (
    <>
      <span className={cn('su-sr-only', wordClassName)}>{atomsCopy('next')} </span>
      {to}
      <ChevronRight size={iconSize[size]} aria-hidden="true" />
    </>
  )
}
