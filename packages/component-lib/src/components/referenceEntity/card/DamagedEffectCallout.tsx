import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../../design/tokens'
import { Badge } from '../../atoms/Badge'

/** The frame: a chrome-weight ink frame on its ground, no band and no rail (ruleset §3.10). */
const FRAME = {
  borderColor: color.ink,
  borderRadius: 'var(--radius-card)',
  borderStyle: 'solid',
  borderWidth: 'var(--bw-chrome)',
  // The seam stamp stands half above the frame: room for it.
  marginTop: space[8],
  position: 'relative',
} satisfies CSSProperties

/** The stamp's inset from the frame's left corner (the seam's vertical seat is its own). */
const STAMP = { left: space[12] } satisfies CSSProperties

const EFFECT = {
  color: color.ink,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/** By where it stands: a page's reading column, or a card's body. */
const EFFECT_PAD = {
  page: { fontSize: fontSize.base, padding: `${space[16]} ${space[16]} ${space[12]}` },
  card: { fontSize: fontSize.xs, padding: `${space[12]} ${space[10]} ${space[8]}` },
} satisfies Record<string, CSSProperties>

/**
 * CRAWLER BAY "WHEN DAMAGED" — the framed callout: a chrome-weight ink frame
 * on the ground it stands on, its WHEN DAMAGED stamp riding the top border by
 * its own height (StampSeam, ruleset §7.2), the effect beneath. The damage
 * reads as a treatment on the bay's rules, not as a second hue (ruleset
 * §3.3), so it wears no danger tint. The card filters the same string out of
 * its body prose, so it is said once.
 */
export function DamagedEffectCallout({
  effect,
  onPage = false,
}: {
  effect: string
  /** On a page the effect reads a step under the page's prose; in a card, at its body's size. */
  onPage?: boolean
}) {
  return (
    <div style={FRAME}>
      <Badge shape="stamp" size="mini" seam style={STAMP}>
        When Damaged
      </Badge>
      <p style={{ ...EFFECT, ...EFFECT_PAD[onPage ? 'page' : 'card'] }}>{effect}</p>
    </div>
  )
}
