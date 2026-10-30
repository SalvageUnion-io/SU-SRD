import type { CSSProperties } from 'react'
import { color, fontSize } from '../../../design/tokens'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { SlabSection } from '../../containers/SlabSection'
import { TraitProse } from '../../TraitProse'

const EFFECT = {
  color: color.ink,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/** On a page, at the page's reading size: the prose column's, as its Bay
   Info's: the two are one size of text. */
const EFFECT_PAGE = {
  ...EFFECT,
  fontSize: 'inherit',
  lineHeight: 'inherit',
} satisfies CSSProperties

/** In a card (a live sheet's bay, a Peek), at the card body's size. */
const EFFECT_CARD = { ...EFFECT, fontSize: fontSize.chip } satisfies CSSProperties

/**
 * WHEN DAMAGED — a crawler bay's rules block, one renderer in every context
 * (hard rule R18, EDL E15): a section of the bay, so a Slab over its effect
 * (ruleset §5, N5), on the bay's own Page, in its card, in a Peek and in the
 * live sheet's bay alike. It is the bay's last section, under its Bay Info
 * and its crew NPC. On a live sheet it folds
 * (`fold`, the state it starts in); on the reference and inside a Peek it
 * does not. Only the type size follows the
 * place: the page's reading size on a Page, the card body's elsewhere. Its
 * text comes from `damagedEffectOf` (`whenDamaged.model.ts`), the one reader
 * of its field. The damage reads as a treatment on the bay's rules, not as a
 * second hue (ruleset §3.3), so it wears no danger tint. The card filters the
 * same string out of its body prose, so it is said once.
 */
export function WhenDamaged({
  effect,
  subject,
  onPage = false,
  fold,
  size,
}: {
  effect: string
  /** The bay's name, so each bay's fold is named for it ("Expand Pilot Bay When Damaged"). */
  subject: string
  /** The bay's own Page (`ReferenceEntityCard`'s `onPage`): the page's reading size. */
  onPage?: boolean
  /** A fold control, and the state the section starts in. */
  fold?: 'open' | 'closed'
  /** `mini`: inside the bay's contentful Mini (a live sheet), at its Size. */
  size?: 'mini'
}) {
  // On a Page it is one of the page's sections, as its Actions are.
  if (onPage) {
    return (
      <SlabSection
        title={referenceEntityCopy('whenDamaged')}
        fold={fold}
        foldLabel={referenceEntityCopy('whenDamaged2', { subject })}
        page
        className="su-entity-page__section"
        bodyClassName="su-entity-page__section-body su-entity-page__prose"
      >
        <p style={EFFECT_PAGE}>
          <TraitProse text={effect} />
        </p>
      </SlabSection>
    )
  }
  return (
    <SlabSection
      title={referenceEntityCopy('whenDamaged')}
      fold={fold}
      foldLabel={referenceEntityCopy('whenDamaged2', { subject })}
      size={size}
      className="su-ec-block"
    >
      <p style={EFFECT_CARD}>
        <TraitProse text={effect} />
      </p>
    </SlabSection>
  )
}
