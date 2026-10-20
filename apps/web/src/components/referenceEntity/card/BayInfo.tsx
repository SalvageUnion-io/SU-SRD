import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../../design/tokens'
import { SlabSection } from '../../containers/SlabSection'

/** In a card, the prose keeps the card body's own 6px rhythm. */
const CARD_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

/**
 * BAY INFO — a crawler bay's own rules, the first of its sections: the bay's
 * prose and choices under a Slab that folds (owner's call, 2026-10-20), then
 * its crew NPC, then its WHEN DAMAGED (`WhenDamaged`). `fold` is the state it
 * starts in, the card's `sectionFold`: open on the reference, closed on a
 * live sheet; with none (inside a Peek) it does not fold.
 */
export function BayInfo({
  subject,
  fold,
  onPage = false,
  children,
}: {
  /** The bay's name, so each bay's fold is named for it ("Expand Pilot Bay Bay Info"). */
  subject: string
  fold?: 'open' | 'closed'
  /** The bay's own Page: head and body are the page's blocks, 12px apart. */
  onPage?: boolean
  children: ReactNode
}) {
  return (
    <SlabSection
      title="Bay Info"
      fold={fold}
      foldLabel={`${subject} Bay Info`}
      page={onPage}
      className="su-ec-block"
      bodyClassName={onPage ? 'su-entity-page__section-body' : undefined}
      bodyStyle={onPage ? undefined : CARD_BODY}
    >
      {children}
    </SlabSection>
  )
}
