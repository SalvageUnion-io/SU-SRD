/**
 * EntityGridRow — the live sheets' entity-card cell.
 *
 * A layout cell, not a card. It wraps ONE entity card in a `min-width: 0` cell
 * (so a long unbreakable string can't blow out the column). Card actions ride
 * the card's own `controls` overlay.
 *
 * The row is the cell; the FLOW around it is `MasonryColumns`.
 */

import type { CSSProperties, ReactNode } from 'react'

const CELL = { minWidth: 0 } satisfies CSSProperties

export function EntityGridRow({ children }: { children: ReactNode }) {
  return <div style={CELL}>{children}</div>
}
