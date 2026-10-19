/**
 * `EntitySearcher`'s toolbar: the search field, the Tech level chips inline
 * beside it when there is room, and every other facet row (the Show row
 * included) folded behind a Filters disclosure whose panel scrolls on its own,
 * so the toolbar is never taller than the screen.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, iconSize, space } from '../../design/tokens'
import type { Disclosure } from '../../lib/useDisclosure'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { Field } from '../atoms/Field'
import { Segmented, SegmentedOption } from '../atoms/Segmented'
import { chevronStyle } from './entitySearcherChrome'
import type { FacetRowConfig } from './entitySearcherTypes'

/** A tech level's colour key, before its label: an ink-ruled square. */
const SWATCH = {
  border: `${borderWidth.hairline} solid currentColor`,
  display: 'inline-block',
  height: space[12],
  marginRight: space[6],
  verticalAlign: '-1px',
  width: space[12],
} satisfies CSSProperties

/**
 * A facet row sets a value, the set of what shows (chrome K10, hard rule
 * R29): a `Segmented` of its options, wrapping when it has many.
 */
function FacetChips({ row }: { row: FacetRowConfig }) {
  return (
    <Segmented label={`Filter by ${row.label}`} size="compact" wrap>
      {row.chips.map(({ key, label, active, onClick, swatchStyle }) => (
        <SegmentedOption key={key} pressed={active} onClick={onClick}>
          {swatchStyle != null && (
            <i aria-hidden="true" style={{ ...SWATCH, background: swatchStyle }} />
          )}
          {label}
        </SegmentedOption>
      ))}
    </Segmented>
  )
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
          <div style={INLINE_CHIPS_STYLE}>
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
            <ChevronDown aria-hidden="true" size={iconSize.compact} style={chevronStyle(open)} />
          </Button>
        )}
      </div>
      {folded.length > 0 && (
        <div id={panelId} hidden={!open} style={FILTER_PANEL_STYLE}>
          <div style={FILTER_STACK_STYLE}>
            {folded.map((row) => (
              // The one label (R16) over the row's Segmented, which names its group.
              <Field key={row.label} label={row.label}>
                <FacetChips row={row} />
              </Field>
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
