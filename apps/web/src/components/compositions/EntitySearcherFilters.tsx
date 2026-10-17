/**
 * `EntitySearcher`'s toolbar: the search field, the Tech level chips inline
 * beside it when there is room, and every other facet row (the Show row
 * included) folded behind a Filters disclosure whose panel scrolls on its own,
 * so the toolbar is never taller than the screen.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../design/tokens'
import type { Disclosure } from '../../lib/useDisclosure'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { FilterRow } from '../containers/FilterRow'
import { chevronStyle } from './entitySearcherChrome'
import type { FacetRowConfig } from './entitySearcherTypes'

function FacetChips({ row }: { row: FacetRowConfig }) {
  return row.chips.map(({ key, label, active, onClick, swatchStyle }) => (
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
  ))
}

/**
 * `inline` is the one facet row that sits beside the search field (Tech
 * level, on a wide screen); `folded` are the rows behind Filters. A searcher
 * with neither shows the field alone.
 */
export function SearcherToolbar({
  search,
  inline,
  folded,
  activeFilters,
  filters: { open, panelId, toggleProps },
}: {
  search: ReactNode
  inline: FacetRowConfig | null
  folded: FacetRowConfig[]
  activeFilters: number
  /** The Filters disclosure (`useDisclosure`). */
  filters: Disclosure
}) {
  return (
    <div className="su-searcher__toolbar">
      <div style={TOOL_ROW_STYLE}>
        <div style={SEARCH_SLOT_STYLE}>{search}</div>
        {inline && (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this chip row; role="group" + aria-label conveys the same semantics
          <div role="group" aria-label={`Filter by ${inline.label}`} style={INLINE_CHIPS_STYLE}>
            <FacetChips row={inline} />
          </div>
        )}
        {folded.length > 0 && (
          <Button size="compact" {...toggleProps} style={FILTERS_TOGGLE_STYLE}>
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
      {folded.length > 0 && (
        <div id={panelId} hidden={!open} style={FILTER_PANEL_STYLE}>
          <div style={FILTER_STACK_STYLE}>
            {folded.map((row) => (
              <FilterRow key={row.label} label={row.label}>
                <FacetChips row={row} />
              </FilterRow>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const TOOL_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties
const SEARCH_SLOT_STYLE = { flex: '1 1 14rem', minWidth: 0 } satisfies CSSProperties
const INLINE_CHIPS_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties
const FILTERS_TOGGLE_STYLE = { flexShrink: 0 } satisfies CSSProperties
/** Open, the facet rows scroll inside their own panel rather than growing the
 * toolbar, so open filters never take more than 40% of the screen. No
 * `display` here: the panel folds with the `hidden` attribute. */
const FILTER_PANEL_STYLE = {
  maxHeight: '40dvh',
  overflowY: 'auto',
  marginTop: space[8],
} satisfies CSSProperties
const FILTER_STACK_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  paddingBottom: space[4],
} satisfies CSSProperties
