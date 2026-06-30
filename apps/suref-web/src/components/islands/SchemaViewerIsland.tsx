import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getEntitySlug, getTree } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  FilterChip,
  FilterRow,
  MasonryColumns,
  TECH_LEVEL_STYLES,
  techLevelLabel,
  EntityHrefProvider,
  EntityDetailLinkProvider,
} from 'suref-react'
import { GameDataGate } from '../../lib/useGameData'
import { srdEntityHref } from '../../lib/entityHref'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type SchemaViewerIslandProps = {
  initialData: SURefEntity[]
  schemaId: string
  techLevels: (number | 'B' | 'N')[]
  sources: string[]
}

export function SchemaViewerIsland({
  initialData,
  schemaId,
  techLevels,
  sources,
}: SchemaViewerIslandProps) {
  const [techLevelFilters, setTechLevelFilters] = useState<Set<string>>(new Set())
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set())
  const [nameFilter, setNameFilter] = useState('')

  const filteredData = useMemo(() => {
    return initialData.filter((item) => {
      if (techLevelFilters.size > 0) {
        const techLevel = getTechLevel(item)
        const itemTechLevel = techLevel?.toString()
        if (!itemTechLevel || !techLevelFilters.has(itemTechLevel)) {
          return false
        }
      }

      if (sourceFilters.size > 0) {
        const itemSource = getSource(item)
        if (!itemSource || !sourceFilters.has(itemSource)) {
          return false
        }
      }

      if (nameFilter) {
        if (!item.name.toLowerCase().includes(nameFilter.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }, [initialData, techLevelFilters, sourceFilters, nameFilter])

  const toggleTechLevel = (level: number | 'B' | 'N') => {
    setTechLevelFilters((prev) => {
      if (prev.size === 0) return new Set([String(level)])
      const next = new Set(prev)
      const key = String(level)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (techLevels.every((tl) => next.has(String(tl)))) return new Set()
      return next
    })
  }

  const toggleSource = (source: string) => {
    setSourceFilters((prev) => {
      if (prev.size === 0) return new Set([source])
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      if (sources.every((s) => next.has(s))) return new Set()
      return next
    })
  }

  const hasFilters = techLevels.length > 1 || sources.length > 1
  // Show the name input whenever the dataset is large enough to benefit from it
  const hasNameFilter = initialData.length > 12

  // Browse layout: filters always stack in a bar above the entity grid (at every
  // breakpoint), with the grid spanning full width below them.
  const containerClass = 'mx-auto w-full max-w-[1400px]'
  const showAside = hasFilters || hasNameFilter

  const hasActiveFilters = techLevelFilters.size > 0 || sourceFilters.size > 0 || nameFilter !== ''

  const clearFilters = () => {
    setTechLevelFilters(new Set())
    setSourceFilters(new Set())
    setNameFilter('')
  }

  return (
    <IslandErrorBoundary>
      <GameDataGate
        fallback={
          <div className={containerClass}>
            <div className="w-full min-w-0 px-2 pb-6 md:px-6">
              <MasonryColumns>
                {Array.from({ length: 9 }, (_, i) => (
                  <ReferenceEntityCardSkeleton key={i} compact />
                ))}
              </MasonryColumns>
            </div>
          </div>
        }
      >
        <div className={containerClass}>
          {showAside && (
            <aside className="mb-6 flex w-full flex-col gap-4 px-2 pt-2 md:px-6 print:hidden">
              {/* Search + Tech Level sit side by side on normal-sized screens
                  (md+), stacking on narrow viewports. Source stays on its own row. */}
              {(hasNameFilter || techLevels.length > 1) && (
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                  {hasNameFilter && (
                    <div className="md:shrink-0">
                      <FilterRow label="Name">
                        <input
                          type="search"
                          name="name-filter"
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          placeholder="Filter by name…"
                          aria-label="Filter items by name"
                          className="w-full rounded border border-su-black bg-su-white px-2 py-1 font-mono text-[13px] md:w-64"
                        />
                      </FilterRow>
                    </div>
                  )}
                  {techLevels.length > 1 && (
                    <div className="md:flex-1">
                      <FilterRow label="Tech Level">
                        <FilterChip
                          label="All"
                          active={techLevelFilters.size === 0}
                          onClick={() => setTechLevelFilters(new Set())}
                        />
                        {techLevels.map((level) => {
                          const numericLevel = typeof level === 'number' ? level : undefined
                          const swatchStyle =
                            numericLevel !== undefined
                              ? `var(--color-tl-${numericLevel})`
                              : undefined
                          return (
                            // colorClass is only consumed in the non-swatch (B/N) branch; a
                            // numeric chip renders the swatch and ignores it, so omit it there.
                            <FilterChip
                              key={String(level)}
                              label={techLevelLabel(level)}
                              active={techLevelFilters.has(String(level))}
                              onClick={() => toggleTechLevel(level)}
                              colorClass={
                                swatchStyle ? undefined : TECH_LEVEL_STYLES[String(level)]
                              }
                              swatchStyle={swatchStyle}
                            />
                          )
                        })}
                      </FilterRow>
                    </div>
                  )}
                </div>
              )}

              {sources.length > 1 && (
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
                      onClick={() => toggleSource(source)}
                    />
                  ))}
                </FilterRow>
              )}
            </aside>
          )}

          {/* Entity Grid */}
          <div className="w-full min-w-0 px-2 pb-6 md:px-6">
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-4">
                <p className="text-sm text-su-grey-dark">No items match the current filters.</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase transition-colors bg-su-grey-light text-su-black hover:bg-su-grey-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <EntityHrefProvider value={srdEntityHref}>
                <EntityDetailLinkProvider value={true}>
                  <MasonryColumns>
                    {filteredData.map((item: SURefEntity) => {
                      const tree = schemaId === 'abilities' ? (getTree(item) as string) : undefined
                      return (
                        <a
                          key={item.id}
                          href={`/schema/${schemaId}/item/${getEntitySlug(item)}/`}
                          aria-label={item.name}
                          className="relative block"
                        >
                          <Suspense fallback={<ReferenceEntityCardSkeleton compact />}>
                            <ReferenceEntityDisplay
                              hide={{ actions: true, choices: true }}
                              data={item}
                              compact
                              label={tree}
                              cardClickable
                            />
                          </Suspense>
                        </a>
                      )
                    })}
                  </MasonryColumns>
                </EntityDetailLinkProvider>
              </EntityHrefProvider>
            )}
          </div>
        </div>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}
