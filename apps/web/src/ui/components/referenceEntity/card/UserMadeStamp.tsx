import { Badge } from '../../atoms/Badge'
import { USER_MADE_TITLE } from './cardChrome'

/**
 * The dashed User-made stamp (ruleset §3.9): the mini stamp on its dashed
 * plate, and the tooltip saying what it means. Dashes already mean "pencil, not
 * print"; this carries that to the whole card. A full user-made page leads its
 * title with the same stamp, naming what the thing is ("User-made pattern").
 */
export function UserMadeStamp({ label = 'User-made' }: { label?: string }) {
  return (
    <Badge shape="stamp" size="mini" surface="dashed" title={USER_MADE_TITLE}>
      {label}
    </Badge>
  )
}
