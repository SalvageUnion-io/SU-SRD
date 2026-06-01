import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getEntitySlug, getTree } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  FilterChip,
  FilterRow,
  TECH_LEVEL_STYLES,
  techLevelLabel,
} from 'suref-react'
import { GameDataGate } from '../../lib/useGameData'

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

      return true
    })
  }, [initialData, techLevelFilters, sourceFilters])

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

  // Browse layout: a fixed left filter rail beside the entity grid on desktop
  // (design board-srd.jsx:96), collapsing to stacked filters above the grid on
  // mobile. When there are no facets to filter, the grid spans full width.
  const containerClass = hasFilters
    ? 'mx-auto w-full max-w-[1400px] lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8'
    : 'mx-auto w-full max-w-[1400px]'

  return (
    <GameDataGate>
      <div className={containerClass}>
        {hasFilters && (
          <aside className="mb-4 flex w-full flex-col gap-4 lg:mb-0 lg:py-6">
            {techLevels.length > 1 && (
              <FilterRow label="Tech Level">
                <FilterChip
                  label="All"
                  active={techLevelFilters.size === 0}
                  onClick={() => setTechLevelFilters(new Set())}
                />
                {techLevels.map((level) => {
                  const numericLevel = typeof level === 'number' ? level : undefined
                  const swatchStyle =
                    numericLevel !== undefined ? `var(--color-tl-${numericLevel})` : undefined
                  return (
                    <FilterChip
                      key={String(level)}
                      label={techLevelLabel(level)}
                      active={techLevelFilters.has(String(level))}
                      onClick={() => toggleTechLevel(level)}
                      colorClass={TECH_LEVEL_STYLES[String(level)]}
                      swatchStyle={swatchStyle}
                    />
                  )
                })}
              </FilterRow>
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
        <div className="w-full min-w-0 flex-1 px-2 py-6 md:p-6 lg:px-0">
          <div className="columns-1 gap-4 md:columns-2 lg:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
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
          </div>
        </div>
      </div>
    </GameDataGate>
  )
}
