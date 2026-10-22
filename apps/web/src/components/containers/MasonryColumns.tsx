import type { ReactNode } from 'react'
import { Children } from 'react'
import { widthAtLeast } from '../../design/tokens'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { RadioCardGroup } from './RadioCardGroup'

/** `.su-masonry` (`styles/partials/containers.css`): it collapses to one block in print. */
const FLOW = 'su-masonry'

type MasonryColumnsProps = {
  children: ReactNode
  /**
   * Cap the column count. Defaults to 3 (the viewport ladder 1 / 2 / 3). Pass
   * `2` for constrained lists — e.g. wizard selection pools, which never split
   * past two columns.
   */
  maxColumns?: number
  /**
   * Radio-group semantics for exactly-one pickers: the flow is a
   * `RadioCardGroup`. Pair with `ReferenceEntityCard` cells using
   * `selectionRole="radio"` / `TitledBox` cells in select mode, and pass an accessible
   * group name via `ariaLabel`.
   */
  radio?: boolean
  /** Accessible name for the radiogroup (required when `radio` is set). */
  ariaLabel?: string
}

// Column count is driven purely by viewport width via matchMedia, on the
// ladder's md and xl rungs (1 column < 48rem, 2 from 48rem, 3 from 80rem).
// matchMedia listeners fire ONLY when a breakpoint is crossed, so resizing
// within a breakpoint does zero JS work and triggers no redistribution.
const MD = widthAtLeast('md')
const XL = widthAtLeast('xl')

function useColumnCount(): number {
  // The server snapshot (1 column: both queries answer false) is used for SSR
  // *and* the first hydration render, so the client's initial tree matches the
  // SSR HTML; React then reconciles to the live viewport column count without
  // a hydration mismatch (React #418). Seeding useState from `window` instead
  // rendered 1 column on the server but 2–3 on the client's first render,
  // breaking hydration.
  const xl = useMediaQuery(XL, false)
  const md = useMediaQuery(MD, false)
  if (xl) return 3
  if (md) return 2
  return 1
}

/**
 * Masonry layout built from independent flex columns instead of CSS
 * multi-column. CSS `columns` re-balances every card on every resize frame
 * (a binary search of full layout passes), which janks on large lists. Here
 * each column is its own block flow with no cross-column balancing, so a resize
 * within a breakpoint costs nothing. Cards are distributed round-robin, so
 * columns balance by count rather than exact height.
 *
 * Print collapses to a single stacked column (`.su-masonry` in `styles/partials/containers.css`).
 */
export function MasonryColumns({
  children,
  maxColumns = 3,
  radio = false,
  ariaLabel,
}: MasonryColumnsProps) {
  const columnCount = Math.min(useColumnCount(), maxColumns)
  const items = Children.toArray(children)

  const columns: ReactNode[][] = Array.from({ length: columnCount }, () => [])
  items.forEach((child, i) => {
    columns[i % columnCount]?.push(child)
  })

  const flow = columns.map((col, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional buckets — the index IS their identity
    <div key={i} className="su-masonry-column">
      {col}
    </div>
  ))

  return radio ? (
    <RadioCardGroup label={ariaLabel ?? ''} className={FLOW}>
      {flow}
    </RadioCardGroup>
  ) : (
    <div className={FLOW}>{flow}</div>
  )
}
