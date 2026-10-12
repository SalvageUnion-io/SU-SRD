import type { CSSProperties } from 'react'
import { useState } from 'react'
import { getSource, getTechLevel, getTree, SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Badge } from '../atoms/Badge'
import { FilterRow } from './FilterRow'

/**
 * FilterRow — the labelled filter band above SRD listings (SchemaViewerIsland,
 * SearchResultsIsland): a small-caps label with a wrapping run of controls
 * beside it. Facet values here are derived from the real dataset, exactly as
 * the reference site derives them.
 */
export default {
  title: 'Containers/Filter Row',
}

const GROUP = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

/** Full width, then 16rem from `md` (`.su-story-filter-input`, `_stories.css`). */
const INPUT = {
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  borderColor: color.ink,
  backgroundColor: color.paper,
  padding: `${space[4]} ${space[8]}`,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

const systems = SalvageUnionReference.Systems.all()
const techLevels = [...new Set(systems.map(getTechLevel).filter((tl) => tl !== undefined))].sort(
  (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })
)
const sources = [
  ...new Set(systems.map(getSource).filter((s): s is string => typeof s === 'string')),
]
const trees = [
  ...new Set(
    SalvageUnionReference.Abilities.all()
      .map(getTree)
      .filter((t): t is string => typeof t === 'string')
  ),
].slice(0, 6)

/**
 * The three production rows: a name search input, Tech Level swatch chips, and
 * plain Source / Tree chips — each an "All" chip plus one chip per facet value,
 * live via useState as on the schema pages.
 */
export const Default: Story = () => {
  const [nameFilter, setNameFilter] = useState('')
  const [tlFilters, setTlFilters] = useState<Set<string>>(new Set())
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set())
  const [treeFilters, setTreeFilters] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  return (
    <div style={{ display: 'flex', maxWidth: '48rem', flexDirection: 'column', gap: space[24] }}>
      <div style={GROUP}>
        <Caption>Name — an arbitrary control (search input), not just chips</Caption>
        <FilterRow label="Name">
          <input
            type="search"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by name…"
            aria-label="Filter items by name"
            className="su-story-filter-input"
            style={INPUT}
          />
        </FilterRow>
      </div>

      <div style={GROUP}>
        <Caption>Tech Level — swatch chips coloured from the TL palette</Caption>
        <FilterRow label="Tech Level">
          <Badge
            shape="chip"
            as="button"
            aria-pressed={tlFilters.size === 0}
            surface={tlFilters.size === 0 ? 'solid' : 'ghost'}
            onClick={() => setTlFilters(new Set())}
          >
            All
          </Badge>
          {techLevels.map((level) => (
            <Badge
              key={String(level)}
              shape="chip"
              as="button"
              aria-pressed={tlFilters.has(String(level))}
              surface={tlFilters.has(String(level)) ? 'solid' : 'ghost'}
              swatch={typeof level === 'number' ? `var(--color-tl-${level})` : undefined}
              onClick={() => setTlFilters((s) => toggle(s, String(level)))}
            >
              {level === 'B' ? 'BIO' : level === 'N' ? 'NANITE' : `TL${level}`}
            </Badge>
          ))}
        </FilterRow>
      </div>

      <div style={GROUP}>
        <Caption>Source — plain chips; the run wraps under the label</Caption>
        <FilterRow label="Source">
          <Badge
            shape="chip"
            as="button"
            aria-pressed={sourceFilters.size === 0}
            surface={sourceFilters.size === 0 ? 'solid' : 'ghost'}
            onClick={() => setSourceFilters(new Set())}
          >
            All
          </Badge>
          {sources.map((source) => (
            <Badge
              key={source}
              shape="chip"
              as="button"
              aria-pressed={sourceFilters.has(source)}
              surface={sourceFilters.has(source) ? 'solid' : 'ghost'}
              onClick={() => setSourceFilters((s) => toggle(s, source))}
            >
              {source}
            </Badge>
          ))}
        </FilterRow>
      </div>

      <div style={GROUP}>
        <Caption>Tree — the abilities-only facet</Caption>
        <FilterRow label="Tree">
          <Badge
            shape="chip"
            as="button"
            aria-pressed={treeFilters.size === 0}
            surface={treeFilters.size === 0 ? 'solid' : 'ghost'}
            onClick={() => setTreeFilters(new Set())}
          >
            All
          </Badge>
          {trees.map((tree) => (
            <Badge
              key={tree}
              shape="chip"
              as="button"
              aria-pressed={treeFilters.has(tree)}
              surface={treeFilters.has(tree) ? 'solid' : 'ghost'}
              onClick={() => setTreeFilters((s) => toggle(s, tree))}
            >
              {tree}
            </Badge>
          ))}
        </FilterRow>
      </div>

      <Caption>
        Below the sm breakpoint the label stacks above a centred chip run — narrow the viewport to
        see the mobile layout.
      </Caption>
    </div>
  )
}
