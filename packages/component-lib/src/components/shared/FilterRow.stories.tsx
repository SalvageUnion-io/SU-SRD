import type { Story } from '@ladle/react'
import { useState } from 'react'
import { getSource, getTechLevel, getTree, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { FilterChip } from './FilterChip'
import { FilterRow } from './FilterRow'
import { techLevelLabel } from './techLevelStyles'

/**
 * FilterRow — the labelled filter band above SRD listings (SchemaViewerIsland,
 * SearchResultsIsland): a small-caps label with a wrapping run of controls
 * beside it. Facet values here are derived from the real dataset, exactly as
 * the reference site derives them.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Filter Row',
}

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
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Caption>Name — an arbitrary control (search input), not just chips</Caption>
        <FilterRow label="Name">
          <input
            type="search"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by name…"
            aria-label="Filter items by name"
            className="w-full rounded-card border border-ink bg-paper px-2 py-1 font-body text-caption md:w-64"
          />
        </FilterRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <Caption>Tech Level — swatch chips coloured from the TL palette</Caption>
        <FilterRow label="Tech Level">
          <FilterChip
            label="All"
            active={tlFilters.size === 0}
            onClick={() => setTlFilters(new Set())}
          />
          {techLevels.map((level) => (
            <FilterChip
              key={String(level)}
              label={techLevelLabel(level)}
              active={tlFilters.has(String(level))}
              onClick={() => setTlFilters((s) => toggle(s, String(level)))}
              swatchStyle={typeof level === 'number' ? `var(--color-tl-${level})` : undefined}
            />
          ))}
        </FilterRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <Caption>Source — plain chips; the run wraps under the label</Caption>
        <FilterRow label="Source">
          <FilterChip
            label="All"
            active={sourceFilters.size === 0}
            onClick={() => setSourceFilters(new Set())}
          />
          {sources.map((source) => (
            <FilterChip
              key={source}
              label={source}
              active={sourceFilters.has(source)}
              onClick={() => setSourceFilters((s) => toggle(s, source))}
            />
          ))}
        </FilterRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <Caption>Tree — the abilities-only facet</Caption>
        <FilterRow label="Tree">
          <FilterChip
            label="All"
            active={treeFilters.size === 0}
            onClick={() => setTreeFilters(new Set())}
          />
          {trees.map((tree) => (
            <FilterChip
              key={tree}
              label={tree}
              active={treeFilters.has(tree)}
              onClick={() => setTreeFilters((s) => toggle(s, tree))}
            />
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
