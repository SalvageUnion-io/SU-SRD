/**
 * `EntitySearcher`'s sub-header: the search field and the facet rows. Wide,
 * the rows sit inline with the field opposite the "Show" row; narrow, the
 * field stays in reach and the rows fold behind a Filters disclosure whose
 * panel scrolls on its own, so the header is never taller than the screen.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { FilterRow } from '../containers/FilterRow'
import { chevronStyle } from './entitySearcherChrome'
import type { FacetRowConfig } from './entitySearcherTypes'

function FacetRow({ row }: { row: FacetRowConfig }) {
  return (
    <FilterRow label={row.label}>
      {row.chips.map(({ key, label, active, onClick, swatchStyle }) => (
        <Badge
          key={key}
          shape="chip"
          as="button"
          aria-pressed={active}
          surface={active ? 'solid' : 'ghost'}
          swatch={swatchStyle}
          onClick={onClick}
        >
          {label}
        </Badge>
      ))}
    </FilterRow>
  )
}

/** Wide: the facet rows, with the search field on the final row spaced
 * OPPOSITE the "Show" facet. */
export function WideSubHeader({
  facetRows,
  showRow,
  search,
}: {
  facetRows: FacetRowConfig[]
  showRow: FacetRowConfig | null
  search: ReactNode
}) {
  return (
    <div style={SUBHEADER_STYLE}>
      {facetRows.map((row) => (
        <FacetRow key={row.label} row={row} />
      ))}
      <div style={WIDE_SEARCH_ROW_STYLE}>
        {showRow ? <FacetRow row={showRow} /> : <span aria-hidden="true" />}
        <div className="su-searcher__search-slot">{search}</div>
      </div>
    </div>
  )
}

/** Narrow: the search field always in reach, every facet row (Show included)
 * behind a Filters disclosure whose panel scrolls on its own. */
export function NarrowSubHeader({
  rows,
  activeFilters,
  open,
  onToggle,
  panelId,
  search,
}: {
  rows: FacetRowConfig[]
  activeFilters: number
  open: boolean
  onToggle: () => void
  panelId: string
  search: ReactNode
}) {
  return (
    <div style={SUBHEADER_STYLE}>
      <div style={SEARCH_ROW_STYLE}>
        <div style={SEARCH_SLOT_STYLE}>{search}</div>
        {rows.length > 0 && (
          <Button
            size="compact"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            style={FILTERS_TOGGLE_STYLE}
          >
            Filters
            {activeFilters > 0 && (
              <>
                {' '}
                <Badge shape="chip">{activeFilters}</Badge>
                <span className="su-sr-only"> active</span>
              </>
            )}
            <ChevronDown aria-hidden="true" style={chevronStyle(open)} />
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <div id={panelId} hidden={!open} style={FILTER_PANEL_STYLE}>
          <div style={FILTER_STACK_STYLE}>
            {rows.map((row) => (
              <FacetRow key={row.label} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** The search field's frame. The focus ring is `FOCUS_WITHIN`'s box-shadow,
 * the one property that changes, so everything here is static. */
/** Both sub-headers: a full-width column. */
const SUBHEADER_STYLE = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

/** Wide: the facet rows, then the Show row with the search field opposite it.
 * The search slot's width is responsive, so it is `.su-searcher__search-slot`. */
const WIDE_SEARCH_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: space[16],
  rowGap: space[8],
} satisfies CSSProperties

const SEARCH_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties
const SEARCH_SLOT_STYLE = { flex: '1 1 auto', minWidth: 0 } satisfies CSSProperties
const FILTERS_TOGGLE_STYLE = { flexShrink: 0 } satisfies CSSProperties
/** Open, the facet rows scroll inside their own panel rather than growing the
 * header, so open filters never take more than 40% of the screen. No `display`
 * here: the panel folds with the `hidden` attribute. */
const FILTER_PANEL_STYLE = { maxHeight: '40dvh', overflowY: 'auto' } satisfies CSSProperties
const FILTER_STACK_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  paddingBottom: space[4],
} satisfies CSSProperties
