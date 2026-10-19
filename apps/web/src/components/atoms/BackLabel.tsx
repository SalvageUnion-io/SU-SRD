import { ChevronLeft } from 'lucide-react'
import { iconSize } from '../../design/tokens'

/**
 * BackLabel — what a back control says (chrome K11, hard rule R23): the
 * `ChevronLeft` glyph at the line's Size and the place's name ("Hangar",
 * "Play", "Game"), never an arrow character or a sentence. Its accessible name
 * reads "Back to <place>", the visible name inside it (WCAG 2.5.3).
 *
 * Content, not a control: it goes inside the link or button that goes back.
 */
export function BackLabel({
  to,
  size = 'compact',
}: {
  /** The place's name. */
  to: string
  /** The Size of the line the control sits on. */
  size?: keyof typeof iconSize
}) {
  return (
    <>
      <ChevronLeft size={iconSize[size]} aria-hidden="true" />
      <span className="su-sr-only">Back to </span>
      {to}
    </>
  )
}
