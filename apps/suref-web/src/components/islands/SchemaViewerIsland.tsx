import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getEntitySlug, getTree } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  FilterChip,
  TECH_LEVEL_STYLES,
  techLevelLabel,
} from 'suref-react'

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
      const next = new Set(prev)
      const key = String(level)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleSource = (source: string) => {
    setSourceFilters((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  const hasFilters = techLevels.length > 1 || sources.length > 1

  return (
    <>
      {hasFilters && (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3">
          {techLevels.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tech level">
              <FilterChip
                label="All"
                active={techLevelFilters.size === 0}
                onClick={() => setTechLevelFilters(new Set())}
              />
              {techLevels.map((level) => (
                <FilterChip
                  key={String(level)}
                  label={techLevelLabel(level)}
                  active={techLevelFilters.has(String(level))}
                  onClick={() => toggleTechLevel(level)}
                  colorClass={TECH_LEVEL_STYLES[String(level)]}
                />
              ))}
            </div>
          )}

          {sources.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
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
            </div>
          )}
        </div>
      )}

      {/* Entity Grid */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-[1400px] columns-1 gap-4 md:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {filteredData.map((item: SURefEntity) => {
            const tree = schemaId === 'abilities' ? (getTree(item) as string) : undefined
            return (
              <a
                key={item.id}
                href={`/schema/${schemaId}/item/${getEntitySlug(item)}`}
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
    </>
  )
}
