import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { iconSize } from '../../design/tokens'
import { atomsCopy } from '../../messages/components-atoms'

/**
 * NextLabel — what a forward control says (chrome K11, hard rule R23), the
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
}: {
  /** The place's name. */
  to: ReactNode
  /** The Size of the line the control sits on. */
  size?: keyof typeof iconSize
}) {
  return (
    <>
      <span className="su-sr-only">{atomsCopy('next')} </span>
      {to}
      <ChevronRight size={iconSize[size]} aria-hidden="true" />
    </>
  )
}
