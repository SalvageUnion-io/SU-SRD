import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

/**
 * THE fold control — the Row ⇄ Card disclosure: a chevron whose name
 * ("<subject> details") stays put while `aria-expanded` carries the state, and
 * whose `aria-controls` names the card wrapper (`surfaceId`), which takes that
 * id (`resolveCardInteraction`).
 *
 * `ReferenceEntityCard`'s `collapsible` builds it, folded with `cardClick` so a
 * pointer click anywhere on a folded card opens it (its own click stops
 * propagation, so the two never both fire). A card that folds only its prose
 * and keeps live fields in view (a crawler bay) builds it without `cardClick`,
 * so typing in a field never unfolds the card around it.
 */
export function foldControl({
  subject,
  folded,
  surfaceId,
  onToggle,
  cardClick = false,
}: {
  subject: string
  folded: boolean
  surfaceId: string
  onToggle: () => void
  /** Folded, a pointer click anywhere on the card opens it too. */
  cardClick?: boolean
}): ReferenceEntityControl {
  return {
    key: '__fold',
    icon: folded ? ChevronDown : ChevronUp,
    variant: 'ghost',
    className: 'su-card-fold',
    ...(folded && cardClick ? { cardClick: true } : {}),
    ariaLabel: `${subject} details`,
    title: folded ? 'Expand' : 'Collapse',
    ariaExpanded: !folded,
    ariaControls: surfaceId,
    onClick: onToggle,
  }
}
