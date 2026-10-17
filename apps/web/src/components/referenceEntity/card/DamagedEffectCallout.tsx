import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../../design/tokens'
import { Slab } from '../../atoms/Slab'
import { TitledBox } from '../../containers/TitledBox'

const EFFECT = {
  color: color.ink,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/** On a page, in the box: a step under the page's prose, padded off the frame. */
const EFFECT_PAGE = {
  ...EFFECT,
  fontSize: fontSize.base,
  padding: `${space[12]} ${space[16]}`,
} satisfies CSSProperties

/** In a card, under its Slab: at the card body's size, on the body's own padding. */
const EFFECT_CARD = { ...EFFECT, fontSize: fontSize.xs } satisfies CSSProperties

/** The Slab sits close over its effect, as a picker's section label does. */
const SLAB = { marginBottom: space[6] } satisfies CSSProperties

/**
 * CRAWLER BAY "WHEN DAMAGED" — a section of the bay's rules. On the bay's own
 * Page (level 1 there) it is a `TitledBox`: WHEN DAMAGED on the ink band's
 * cut-out, the effect on the paper beneath. Inside a card (a live sheet's bay,
 * a Peek) it is a Slab over the effect, never a box (ruleset N5: no titled box
 * inside an entity). The damage reads as a treatment on the bay's rules, not
 * as a second hue (ruleset §3.3), so it wears no danger tint. The card filters
 * the same string out of its body prose, so it is said once.
 */
export function DamagedEffectCallout({
  effect,
  onPage = false,
}: {
  effect: string
  /** The bay's own Page (`ReferenceEntityCard`'s `onPage`): the titled box, at the page's size. */
  onPage?: boolean
}) {
  if (onPage) {
    return (
      <TitledBox title="When Damaged" body="flush">
        <p style={EFFECT_PAGE}>{effect}</p>
      </TitledBox>
    )
  }
  return (
    <div className="su-ec-block">
      <Slab variant="solid" label="When Damaged" style={SLAB} />
      <p style={EFFECT_CARD}>{effect}</p>
    </div>
  )
}
