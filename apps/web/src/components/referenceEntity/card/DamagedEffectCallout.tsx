import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../../design/tokens'
import { TitledBox } from '../../containers/TitledBox'

const EFFECT = {
  color: color.ink,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/** By where it stands: a page's reading column, or a card's body. */
const EFFECT_PAD = {
  page: { fontSize: fontSize.base, padding: `${space[12]} ${space[16]}` },
  card: { fontSize: fontSize.xs, padding: `${space[8]} ${space[10]}` },
} satisfies Record<string, CSSProperties>

/**
 * CRAWLER BAY "WHEN DAMAGED" — a `TitledBox`: WHEN DAMAGED on the ink band's
 * cut-out, the effect on the paper beneath. The damage reads as a treatment on
 * the bay's rules, not as a second hue (ruleset §3.3), so it wears no danger
 * tint. The card filters the same string out of its body prose, so it is said
 * once. A live sheet's damaged bay draws the same box.
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
    <TitledBox title="When Damaged" body="flush">
      <p style={{ ...EFFECT, ...EFFECT_PAD[onPage ? 'page' : 'card'] }}>{effect}</p>
    </TitledBox>
  )
}
