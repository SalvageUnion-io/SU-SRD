/**
 * `EntitySearcher`'s sub-header: the search field and the facet rows. Wide,
 * the rows sit inline with the field opposite the "Show" row; narrow, the
 * field stays in reach and the rows fold behind a Filters disclosure whose
 * panel scrolls on its own, so the header is never taller than the screen.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { FOCUS_WITHIN } from '../atoms/interaction'
import { FilterRow } from '../containers/FilterRow'
import { chevronStyle, VISUALLY_HIDDEN } from './entitySearcherChrome'
import type { FacetRowConfig } from './entitySearcherTypes'

/** The live text search, at the 16px floor iOS Safari needs. */
export function SearchField({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <label className={FOCUS_WITHIN} style={SEARCH_FIELD_STYLE}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={SEARCH_ICON_STYLE}>
        <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by name or trait…"
        aria-label="Search"
        autoComplete="off"
        // `text-base`, not `text-sm`: iOS Safari zooms the viewport on a focused
        // control below 16px. See the note in `atoms/inputs.tsx`.
        className="su-searcher__input"
        style={SEARCH_INPUT_STYLE}
      />
    </label>
  )
}

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
    <div style={WIDE_SUBHEADER_STYLE}>
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
    <div style={NARROW_SUBHEADER_STYLE}>
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
                <Badge shape="chip" surface="solid">
                  {activeFilters}
                </Badge>
                <span style={VISUALLY_HIDDEN}> active</span>
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
const SEARCH_FIELD_STYLE = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: space[8],
  borderRadius: radius.card,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  backgroundColor: color.paper,
  padding: `${space[8]} ${space[12]}`,
} satisfies CSSProperties
const SEARCH_ICON_STYLE = { opacity: 0.7 } satisfies CSSProperties
/** `color` is not here: the placeholder recolours it, so it lives in
 * `.su-searcher__input` (styles/index.css), resting value included. */
const SEARCH_INPUT_STYLE = {
  width: '100%',
  backgroundColor: 'transparent',
  fontFamily: font.body,
  fontSize: fontSize.base,
  lineHeight: '1.5rem',
  outlineStyle: 'none',
} satisfies CSSProperties

/** Wide: the facet rows, then the Show row with the search field opposite it.
 * The search slot's width is responsive, so it is `.su-searcher__search-slot`. */
const WIDE_SUBHEADER_STYLE = {
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties
const WIDE_SEARCH_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: space[16],
  rowGap: space[8],
} satisfies CSSProperties

const NARROW_SUBHEADER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  width: '100%',
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
