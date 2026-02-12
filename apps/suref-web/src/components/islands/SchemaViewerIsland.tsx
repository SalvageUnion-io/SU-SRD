import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getEntitySlug, isAbility } from 'salvageunion-reference'
import { EntityDisplay, EntityCardSkeleton } from 'suref-react'

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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTechLevelFilters(new Set())}
                aria-pressed={techLevelFilters.size === 0}
                className={`rounded-md px-4 py-2 font-medium transition-colors ${
                  techLevelFilters.size === 0
                    ? 'bg-su-orange text-su-white'
                    : 'border border-su-grey-light bg-su-white text-su-black hover:bg-su-blue-pale'
                }`}
              >
                All
              </button>
              {techLevels.map((level) => {
                const isSelected = techLevelFilters.has(String(level))
                const displayLabel =
                  typeof level === 'number' ? `T${level}` : level === 'B' ? 'Bio' : 'N'
                return (
                  <button
                    key={String(level)}
                    onClick={() => toggleTechLevel(level)}
                    aria-pressed={isSelected}
                    className={`rounded-md px-4 py-2 font-medium transition-colors ${
                      isSelected
                        ? 'bg-su-orange text-su-white'
                        : 'border border-su-grey-light bg-su-white text-su-black hover:bg-su-blue-pale'
                    }`}
                  >
                    {displayLabel}
                  </button>
                )
              })}
            </div>
          )}

          {sources.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSourceFilters(new Set())}
                aria-pressed={sourceFilters.size === 0}
                className={`rounded-md px-4 py-2 font-medium transition-colors ${
                  sourceFilters.size === 0
                    ? 'bg-su-orange text-su-white'
                    : 'border border-su-grey-light bg-su-white text-su-black hover:bg-su-blue-pale'
                }`}
              >
                All
              </button>
              {sources.map((source) => {
                const isSelected = sourceFilters.has(source)
                return (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    aria-pressed={isSelected}
                    className={`rounded-md px-4 py-2 font-medium transition-colors ${
                      isSelected
                        ? 'bg-su-orange text-su-white'
                        : 'border border-su-grey-light bg-su-white text-su-black hover:bg-su-blue-pale'
                    }`}
                  >
                    {source}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Entity Grid */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-[1400px] columns-1 gap-4 lg:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {filteredData.map((item: SURefEntity) => (
            <a
              key={item.id}
              href={`/schema/${schemaId}/item/${getEntitySlug(item)}`}
              className="block cursor-pointer transition-all duration-200 md:hover:scale-105 md:hover:-translate-y-1 md:hover:z-10 md:hover:shadow-lg"
            >
              <Suspense fallback={<EntityCardSkeleton compact />}>
                <EntityDisplay
                  hideActions
                  hideChoices
                  data={item}
                  compact
                  collapsible={false}
                  label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
                />
              </Suspense>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
