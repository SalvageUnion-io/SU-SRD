/*
 * Ported from packages/component-lib/src/components/shared/FilterRow.stories.tsx.
 * Facet values are derived from the real dataset exactly as the reference site
 * derives them; the `useState` toggles become a settled pressed/unpressed mix.
 */
import { Badge, FilterRow } from 'component-lib'
import { getSource, getTechLevel, getTree, SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The labelled filter band above SRD listings — a small-caps label with a
 * wrapping run of controls beside it. The control is arbitrary: chips here, a
 * search input in the Name row.
 */
export function Facets() {
  const systems = SalvageUnionReference.Systems.all()
  const techLevels = [
    ...new Set(systems.map(getTechLevel).filter((tl) => tl !== undefined)),
  ].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
  const sources = [
    ...new Set(systems.map(getSource).filter((s): s is string => typeof s === 'string')),
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-6 bg-paper p-4">
      <Group caption="Name — an arbitrary control (search input), not just chips">
        <FilterRow label="Name">
          <input
            type="search"
            defaultValue=""
            placeholder="Filter by name…"
            aria-label="Filter items by name"
            className="w-full rounded-card border border-ink bg-paper px-2 py-1 font-body text-caption md:w-64"
          />
        </FilterRow>
      </Group>

      <Group caption="Tech Level — swatch chips coloured from the TL palette">
        <FilterRow label="Tech Level">
          <Badge shape="chip" as="button" aria-pressed={false} surface="ghost">
            All
          </Badge>
          {techLevels.map((level, i) => (
            <Badge
              key={String(level)}
              shape="chip"
              as="button"
              aria-pressed={i === 1}
              surface={i === 1 ? 'solid' : 'ghost'}
              swatch={typeof level === 'number' ? `var(--color-tl-${level})` : undefined}
            >
              {`TL${level}`}
            </Badge>
          ))}
        </FilterRow>
      </Group>

      <Group caption="Source — plain chips, one per facet value">
        <FilterRow label="Source">
          <Badge shape="chip" as="button" aria-pressed surface="solid">
            All
          </Badge>
          {sources.slice(0, 4).map((source) => (
            <Badge key={source} shape="chip" as="button" aria-pressed={false} surface="ghost">
              {source}
            </Badge>
          ))}
        </FilterRow>
      </Group>
    </div>
  )
}

/** Ability trees — the same band over a different schema's facet. */
export function TreeFacet() {
  const trees = [
    ...new Set(
      SalvageUnionReference.Abilities.all()
        .map(getTree)
        .filter((t): t is string => typeof t === 'string')
    ),
  ].slice(0, 6)
  return (
    <div className="flex max-w-3xl flex-col gap-6 bg-paper p-4">
      <FilterRow label="Tree">
        <Badge shape="chip" as="button" aria-pressed surface="solid">
          All
        </Badge>
        {trees.map((tree) => (
          <Badge key={tree} shape="chip" as="button" aria-pressed={false} surface="ghost">
            {tree}
          </Badge>
        ))}
      </FilterRow>
    </div>
  )
}
