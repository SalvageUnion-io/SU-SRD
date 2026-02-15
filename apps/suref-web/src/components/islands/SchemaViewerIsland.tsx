import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getEntitySlug, isAbility } from 'salvageunion-reference'
import { EntityDisplay, EntityCardSkeleton } from 'suref-react'
import { Button } from '../Button'

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
        <div className="flex w-full max-w-[1200px] mx-auto flex-col gap-3">
          {techLevels.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tech level">
              <Button
                active={techLevelFilters.size === 0}
                onClick={() => setTechLevelFilters(new Set())}
                aria-pressed={techLevelFilters.size === 0}
              >
                All
              </Button>
              {techLevels.map((level) => {
                const isSelected = techLevelFilters.has(String(level))
                const displayLabel =
                  typeof level === 'number' ? `T${level}` : level === 'B' ? 'Bio' : 'N'
                return (
                  <Button
                    key={String(level)}
                    active={isSelected}
                    onClick={() => toggleTechLevel(level)}
                    aria-pressed={isSelected}
                  >
                    {displayLabel}
                  </Button>
                )
              })}
            </div>
          )}

          {sources.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
              <Button
                active={sourceFilters.size === 0}
                onClick={() => setSourceFilters(new Set())}
                aria-pressed={sourceFilters.size === 0}
              >
                All
              </Button>
              {sources.map((source) => {
                const isSelected = sourceFilters.has(source)
                return (
                  <Button
                    key={source}
                    active={isSelected}
                    onClick={() => toggleSource(source)}
                    aria-pressed={isSelected}
                  >
                    {source}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Entity Grid */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-[1400px] columns-1 gap-4 lg:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {filteredData.map((item: SURefEntity) => {
            const hasLabel = isAbility(item) && !!item.tree
            return (
              <a
                key={item.id}
                href={`/schema/${schemaId}/item/${getEntitySlug(item)}`}
                aria-label={item.name}
                className={`relative block transition-all duration-200 md:hover:z-10 md:hover:scale-[1.02] md:hover:-translate-y-0.5 md:hover:shadow-lg ${hasLabel ? 'pt-2' : ''}`}
              >
                <Suspense fallback={<EntityCardSkeleton compact />}>
                  <EntityDisplay
                    hideActions
                    hideChoices
                    data={item}
                    compact
                    label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
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
