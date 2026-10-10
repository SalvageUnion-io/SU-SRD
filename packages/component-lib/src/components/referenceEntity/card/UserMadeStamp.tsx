import { font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { USER_MADE_TITLE } from './cardChrome'

/**
 * The dashed User-made stamp (ruleset §3.9; issue 1276): paper, a dashed ink edge,
 * and the tooltip saying what it means. Dashes already mean "pencil, not
 * print"; this carries that to the whole card. A full user-made page leads its
 * title with the same stamp, naming what the thing is ("User-made pattern").
 */
export function UserMadeStamp({ label = 'User-made' }: { label?: string }) {
  return (
    <span
      title={USER_MADE_TITLE}
      style={{
        backgroundColor: 'var(--color-paper)',
        border: 'var(--bw-chrome) dashed var(--color-ink)',
        color: 'var(--color-ink)',
        fontFamily: font.cond,
        fontSize: fontSize.badge,
        fontWeight: weight.extrabold,
        letterSpacing: tracking.caps,
        lineHeight: 1.2,
        padding: `0 ${space[6]}`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
