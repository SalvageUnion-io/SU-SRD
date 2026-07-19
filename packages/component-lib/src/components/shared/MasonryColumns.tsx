import { Children, useSyncExternalStore, type ReactNode } from 'react'

type MasonryColumnsProps = {
  children: ReactNode
  /**
   * Tailwind gap utility applied both between columns and between cards within a
   * column. Defaults to `gap-4` (matches the old `gap-4` column gap + `mb-4`).
   */
  gap?: string
  /**
   * Cap the column count. Defaults to 3 (the viewport ladder 1 / 2 / 3). Pass
   * `2` for constrained lists — e.g. wizard selection pools, which never split
   * past two columns.
   */
  maxColumns?: number
  /**
   * Radio-group semantics for exactly-one pickers: wrap the flow in
   * `role="radiogroup"`. Pair with `ReferenceEntityCard` / `Sel` cells using
   * `selectionRole="radio"`, and pass an accessible group name via `ariaLabel`.
   */
  radio?: boolean
  /** Accessible name for the radiogroup (required when `radio` is set). */
  ariaLabel?: string
}

// Column count is driven purely by viewport width via matchMedia, mirroring the
// previous Tailwind breakpoints (1 column < md, 2 at md=48rem, 3 at xl=80rem).
// matchMedia listeners fire ONLY when a breakpoint is crossed, so resizing
// within a breakpoint does zero JS work and triggers no redistribution.
const MD = '(min-width: 48rem)'
const XL = '(min-width: 80rem)'

function columnsForViewport(): number {
  if (typeof window === 'undefined') return 1
  if (window.matchMedia(XL).matches) return 3
  if (window.matchMedia(MD).matches) return 2
  return 1
}

// useSyncExternalStore only subscribes after hydration, so `window` is defined
// whenever this runs.
function subscribeColumns(onChange: () => void): () => void {
  const md = window.matchMedia(MD)
  const xl = window.matchMedia(XL)
  md.addEventListener('change', onChange)
  xl.addEventListener('change', onChange)
  return () => {
    md.removeEventListener('change', onChange)
    xl.removeEventListener('change', onChange)
  }
}

function useColumnCount(): number {
  // The server snapshot (1 column) is used for SSR *and* the first hydration
  // render, so the client's initial tree matches the SSR HTML; React then
  // reconciles to the live viewport column count without a hydration mismatch
  // (React #418). Seeding useState from `window` instead rendered 1 column on
  // the server but 2–3 on the client's first render, breaking hydration.
  return useSyncExternalStore(subscribeColumns, columnsForViewport, () => 1)
}

/**
 * Masonry layout built from independent flex columns instead of CSS
 * multi-column. CSS `columns` re-balances every card on every resize frame
 * (a binary search of full layout passes), which janks on large lists. Here
 * each column is its own block flow with no cross-column balancing, so a resize
 * within a breakpoint costs nothing. Cards are distributed round-robin, so
 * columns balance by count rather than exact height.
 *
 * Print collapses to a single stacked column (`print:block` + `print:w-full`).
 */
export function MasonryColumns({
  children,
  gap = 'gap-4',
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

  return (
    <div
      className={`flex items-start ${gap} print:block`}
      {...(radio ? { role: 'radiogroup', 'aria-label': ariaLabel } : {})}
    >
      {columns.map((col, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional buckets — the index IS their identity
        <div key={i} className={`flex min-w-0 flex-1 flex-col print:w-full ${gap}`}>
          {col}
        </div>
      ))}
    </div>
  )
}
