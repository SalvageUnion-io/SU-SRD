import type { Size } from '../../../styles/sizing'
import { Badge } from '../../atoms/Badge'
import { HOMEBREW, USER_MADE_TITLE } from './cardChrome'

/**
 * The HOMEBREW stamp (ruleset §3.9): the one mark every player-made thing
 * wears — a card's labels, a Compact's marks, a Mini's sheet, a share card, a
 * saved pattern's page — on its dashed plate, with the tooltip saying what it
 * means. Dashes already mean "pencil, not print"; this says it in a word.
 */
export function HomebrewStamp({
  size = 'mini',
  className,
}: {
  /** The rung it sits on: `mini` in a card's labels, `compact` among a Compact's or a page's chips. */
  size?: Size
  className?: string
}) {
  return (
    <Badge
      shape="stamp"
      size={size}
      surface="dashed"
      title={USER_MADE_TITLE}
      {...(className ? { className } : {})}
    >
      {HOMEBREW}
    </Badge>
  )
}
