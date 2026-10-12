/**
 * EntityGridRow — the live sheets' entity-card cell, which injects a card's
 * action economy.
 *
 * A layout cell, not a card. It wraps ONE entity card in a `min-width: 0` cell
 * (so a long unbreakable string can't blow out the column) and folds `footMeta`
 * into the child card's own foot — `Card` / `ReferenceEntityCard` accept it
 * natively, so the clone is a prop pass-through, not markup surgery. Card
 * actions ride the card's own `controls` overlay.
 *
 * The row is the cell; the FLOW around it is `MasonryColumns`.
 */

import type { CardFootMeta } from 'component-lib'
import type { CSSProperties, ReactElement } from 'react'
import { cloneElement } from 'react'

const CELL = { minWidth: 0 } satisfies CSSProperties

/** The card props EntityGridRow may inject (Card/ReferenceEntityCard accept these). */
type InjectableCardProps = {
  footMeta?: CardFootMeta[]
}

type EntityGridRowProps = {
  /** Inline foot meta folded into the card's own foot (e.g. EP · 2, +HEAT · 1). */
  footMeta?: CardFootMeta[]
  /** The entity card to wrap. */
  children: ReactElement<InjectableCardProps>
  className?: string
}

export function EntityGridRow({ footMeta, children, className }: EntityGridRowProps) {
  const card = footMeta ? cloneElement(children, { footMeta }) : children
  return (
    <div className={className} style={CELL}>
      {card}
    </div>
  )
}
