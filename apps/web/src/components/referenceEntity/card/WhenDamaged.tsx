import type { CSSProperties } from 'react'
import { color, fontSize, space } from '../../../design/tokens'
import { Slab } from '../../atoms/Slab'

const EFFECT = {
  color: color.ink,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/** On a page, at the page's reading size. */
const EFFECT_PAGE = { ...EFFECT, fontSize: fontSize.base } satisfies CSSProperties

/** In a card (a live sheet's bay, a Peek), at the card body's size. */
const EFFECT_CARD = { ...EFFECT, fontSize: fontSize.xs } satisfies CSSProperties

/** The Slab sits close over its effect, as a picker's section label does. */
const SLAB = { marginBottom: space[6] } satisfies CSSProperties

/** On a Page the column's gap sets it off its effect, not its own margin. */
const PAGE_SLAB = { marginBottom: 0 } satisfies CSSProperties

/**
 * WHEN DAMAGED — a crawler bay's rules block, one renderer in every context
 * (hard rule R18, EDL E15): a section of the bay, so a Slab over its effect
 * (ruleset §5, N5), on the bay's own Page, in its card, in a Peek and in the
 * live sheet's bay alike. Only the type size follows the place: the page's
 * reading size on a Page, the card body's elsewhere. Its text comes from
 * `damagedEffectOf` (`whenDamaged.model.ts`), the one reader of its field.
 * The damage reads as a treatment on the bay's rules, not as a second hue
 * (ruleset §3.3), so it wears no danger tint. The card filters the same
 * string out of its body prose, so it is said once.
 */
export function WhenDamaged({
  effect,
  onPage = false,
}: {
  effect: string
  /** The bay's own Page (`ReferenceEntityCard`'s `onPage`): the page's reading size. */
  onPage?: boolean
}) {
  // On a Page the Slab and its effect are two of the prose column's blocks, one
  // 12px gap apart (its flex gap, the Page's rhythm, ruleset §1.7).
  if (onPage) {
    return (
      <>
        <Slab label="When Damaged" style={PAGE_SLAB} />
        <p style={EFFECT_PAGE}>{effect}</p>
      </>
    )
  }
  return (
    <div className="su-ec-block">
      <Slab label="When Damaged" style={SLAB} />
      <p style={EFFECT_CARD}>{effect}</p>
    </div>
  )
}
