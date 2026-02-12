import { useState, useMemo, Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  getTechLevel,
  getName,
  getDescription,
  getSource,
  getUniqueTechLevels,
  getUniqueSources,
  getEntitySlug,
} from 'salvageunion-reference'
import { EntityDisplay, EntityCardSkeleton } from 'suref-react'

type SchemaViewerIslandProps = {
  initialData: SURefEntity[]
  schemaId: string
  techLevels?: (number | 'B' | 'N')[]
  sources?: string[]
}

export function SchemaViewerIsland({
  initialData,
  schemaId,
  techLevels: precomputedTechLevels,
  sources: precomputedSources,
}: SchemaViewerIslandProps) {
  const [search, setSearch] = useState('')
  const [techLevelFilters, setTechLevelFilters] = useState<Set<string>>(new Set())
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set())

  const techLevels = useMemo(
    () => precomputedTechLevels ?? getUniqueTechLevels(initialData),
    [initialData, precomputedTechLevels]
  )

  const sources = useMemo(
    () => precomputedSources ?? getUniqueSources(initialData),
    [initialData, precomputedSources]
  )

  const filteredData = useMemo(() => {
    return initialData.filter((item) => {
      if (search) {
        const searchLower = search.toLowerCase()
        const nameMatch = getName(item)?.toLowerCase().includes(searchLower)
        const descMatch = getDescription(item)?.toLowerCase().includes(searchLower)
        if (!nameMatch && !descMatch) return false
      }

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
  }, [initialData, search, techLevelFilters, sourceFilters])

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
      {/* Search + Filters */}
      <div className={`w-full max-w-[600px] mx-auto ${hasFilters ? 'mb-3' : 'mb-2'}`}>
        <input
          type="text"
          placeholder="Search by name or description..."
          aria-label="Search entities by name or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-su-grey-light bg-su-white px-4 py-2 text-su-input-text focus:outline-none focus:ring-2 focus:ring-su-orange"
        />
      </div>

      {hasFilters && (
        <div className="flex w-full max-w-[1200px] mx-auto flex-col gap-3">
          {techLevels.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTechLevelFilters(new Set())}
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
        <div className="mx-auto max-w-[1400px] columns-1 gap-4 md:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {filteredData.map((item: SURefEntity) => (
            <a
              key={item.id}
              href={`/schema/${schemaId}/item/${getEntitySlug(item)}`}
              className="block cursor-pointer transition-all duration-200 md:hover:scale-105 md:hover:-translate-y-1 md:hover:z-10 md:hover:shadow-lg"
            >
              <Suspense fallback={<EntityCardSkeleton compact />}>
                <EntityDisplay hideActions hideChoices data={item} compact collapsible={false} />
              </Suspense>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}
