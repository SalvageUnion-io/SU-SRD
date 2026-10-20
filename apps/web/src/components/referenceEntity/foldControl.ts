import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Disclosure } from '../../lib/useDisclosure'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

/**
 * THE fold control — the Compact ⇄ Card disclosure, built from a `useDisclosure`:
 * a chevron whose name ("<subject> details") stays put while `aria-expanded`
 * carries the state, and whose `aria-controls` names the card wrapper (the
 * disclosure's `panelId`), which takes that id (`resolveCardInteraction`).
 *
 * `ReferenceEntityCard`'s `collapsible` builds it, folded with `cardClick` so a
 * pointer click anywhere on a folded card opens it (its own click stops
 * propagation, so the two never both fire). A card that folds only its prose
 * and keeps live fields in view (a crawler bay) builds it without `cardClick`,
 * so typing in a field never unfolds the card around it.
 */
export function foldControl({
  subject,
  disclosure: { open, panelId, toggle },
  cardClick = false,
  hidden = false,
}: {
  subject: string
  /** Open is the Card; shut, the card is folded. */
  disclosure: Pick<Disclosure, 'open' | 'panelId' | 'toggle'>
  /** Folded, a pointer click anywhere on the card opens it too. */
  cardClick?: boolean
  /** Not drawn: with `cardClick`, the card itself is the disclosure button. */
  hidden?: boolean
}): ReferenceEntityControl {
  const folded = !open
  return {
    key: '__fold',
    icon: folded ? ChevronDown : ChevronUp,
    variant: 'ghost',
    className: 'su-card-fold',
    ...(folded && cardClick ? { cardClick: true } : {}),
    ...(hidden ? { hidden: true } : {}),
    ariaLabel: `${subject} details`,
    title: folded ? 'Expand' : 'Collapse',
    ariaExpanded: open,
    ariaControls: panelId,
    onClick: toggle,
  }
}
