import type { ReactNode } from 'react'
import { Children, isValidElement } from 'react'
import { cn } from '../../lib/cn'
import { RadioCardGroup } from './RadioCardGroup'

/** `.su-masonry` (`styles/partials/containers.css`): it collapses to one block in print. */
const FLOW = 'su-masonry'

/** The cap on the viewport's column count, as the stylesheet reads it. */
const MAX = {
  1: 'su-masonry--max-1',
  2: 'su-masonry--max-2',
  3: undefined,
} as const

type MasonryColumnsProps = {
  children: ReactNode
  /**
   * Cap the column count. Defaults to 3 (the viewport ladder 1 / 2 / 3). Pass
   * `2` for constrained lists — e.g. wizard selection pools, which never split
   * past two columns.
   */
  maxColumns?: 1 | 2 | 3
} & (
  | { radio?: false; ariaLabel?: undefined }
  | {
      /**
       * Radio-group semantics for exactly-one pickers: the flow is a
       * `RadioCardGroup`. Pair with `ReferenceEntityCard` cells using
       * `selectionRole="radio"` / `TitledBox` cells in select mode.
       */
      radio: true
      /** The radiogroup's accessible name. */
      ariaLabel: string
    }
)

/**
 * Masonry: the cards in source order, each whole, flowing down one column and
 * on into the next (CSS multi-column, `.su-masonry`), so each column runs its
 * own height with no ragged gaps between rows. The column count is the
 * viewport's, on the ladder's md and xl rungs (1 column below 48rem, 2 from
 * 48rem, 3 from 80rem), capped by `maxColumns`, all in the stylesheet: a
 * breakpoint crossing re-flows the same elements, so no card remounts and
 * none loses its state, and the server's HTML is the client's.
 *
 * The DOM order is the reading order: down the first column, then the next,
 * so Tab, a screen reader and a radio group's arrow keys move as the eye does.
 *
 * Print collapses to a single stacked column.
 */
export function MasonryColumns({
  children,
  maxColumns = 3,
  radio = false,
  ariaLabel,
}: MasonryColumnsProps) {
  // Each card keeps its own key (`Children.toArray` gives every element one),
  // so its wrapper, and the card, survive any change in the list around it.
  const items = Children.toArray(children).map((child, i) => (
    <div
      key={isValidElement(child) && child.key != null ? child.key : i}
      className="su-masonry__item"
    >
      {child}
    </div>
  ))
  const className = cn(FLOW, MAX[maxColumns])

  return radio ? (
    <RadioCardGroup label={ariaLabel ?? ''} className={className}>
      {items}
    </RadioCardGroup>
  ) : (
    <div className={className}>{items}</div>
  )
}
