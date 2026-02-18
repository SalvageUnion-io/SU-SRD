import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  FilterChip,
  TECH_LEVEL_STYLES,
  techLevelLabel,
  addControl,
} from 'suref-react'
import { Input } from '../ui/input'
import {
  filterAndSplitEntities,
  ALL_TECH_LEVELS,
  getEntityId,
} from '../../lib/entitySelectionUtils'
import type { TechLevelValue } from '../../lib/entitySelectionUtils'
import { ModalShell } from './ModalShell'

type ReferenceEntityPickerModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  entities: SURefEntity[]
  onSelect: (entityId: string) => void
  currentEntityId?: string
  remainingSlots?: number
  remainingBudget?: number
  filter?: (entity: { id: string; name: string }) => boolean
  closeOnSelect?: boolean
}

export function ReferenceEntityPickerModal({
  open,
  onOpenChange,
  title,
  subtitle,
  entities,
  onSelect,
  currentEntityId,
  remainingSlots,
  remainingBudget,
  filter,
  closeOnSelect,
}: ReferenceEntityPickerModalProps) {
  const [search, setSearch] = useState('')
  const [activeTechLevels, setActiveTechLevels] = useState<Set<TechLevelValue>>(
    () => new Set(ALL_TECH_LEVELS)
  )
  const [activeSourceFilters, setActiveSourceFilters] = useState<Set<string>>(new Set())

  // Reset filters when dialog closes
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSearch('')
        setActiveTechLevels(new Set(ALL_TECH_LEVELS))
        setActiveSourceFilters(new Set())
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const availableTechLevels = useMemo(() => {
    const found = new Set<TechLevelValue>()
    for (const entity of entities) {
      const tl = getTechLevel(entity)
      if (tl !== undefined) found.add(tl as TechLevelValue)
    }
    return ALL_TECH_LEVELS.filter((tl) => found.has(tl))
  }, [entities])

  const availableSources = useMemo(() => {
    const found = new Set<string>()
    for (const entity of entities) {
      const src = getSource(entity)
      if (src) found.add(src)
    }
    const sorted = [...found].sort()
    const wmIndex = sorted.findIndex((s) => s === 'Salvage Union Workshop Manual')
    if (wmIndex > 0) {
      const [wm] = sorted.splice(wmIndex, 1)
      sorted.unshift(wm!)
    }
    return sorted
  }, [entities])

  const allTechActive = availableTechLevels.every((tl) => activeTechLevels.has(tl))
  const allSourcesActive = activeSourceFilters.size === 0

  const toggleAllTech = useCallback(() => {
    setActiveTechLevels(allTechActive ? new Set() : new Set(ALL_TECH_LEVELS))
  }, [allTechActive])

  const toggleTechLevel = useCallback(
    (tl: TechLevelValue) => {
      setActiveTechLevels((prev) => {
        const allActive = availableTechLevels.every((t) => prev.has(t))
        if (allActive) return new Set([tl])
        const next = new Set(prev)
        if (next.has(tl)) next.delete(tl)
        else next.add(tl)
        return next
      })
    },
    [availableTechLevels]
  )

  const toggleSource = useCallback(
    (source: string) => {
      setActiveSourceFilters((prev) => {
        if (prev.size === 0) return new Set([source])
        const next = new Set(prev)
        if (next.has(source)) next.delete(source)
        else next.add(source)
        if (availableSources.every((s) => next.has(s))) return new Set()
        return next
      })
    },
    [availableSources]
  )

  const { selectable, overCapacity, overBudget } = useMemo(
    () =>
      filterAndSplitEntities({
        entities,
        search,
        activeTechLevels,
        activeSourceFilters,
        remainingSlots,
        remainingBudget,
        filter,
      }),
    [
      entities,
      filter,
      search,
      activeTechLevels,
      activeSourceFilters,
      remainingSlots,
      remainingBudget,
    ]
  )

  const handleSelect = useCallback(
    (entityId: string) => {
      onSelect(entityId)
      if (closeOnSelect) handleOpenChange(false)
    },
    [onSelect, closeOnSelect, handleOpenChange]
  )

  return (
    <ModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      subtitle={subtitle}
      description={subtitle ?? `Select an item from ${title}.`}
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Search + filters */}
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-su-grey-light/50 bg-su-white text-su-black placeholder:text-su-grey-dark"
          />

          {availableTechLevels.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label="All" active={allTechActive} onClick={toggleAllTech} />
              {availableTechLevels.map((tl) => (
                <FilterChip
                  key={String(tl)}
                  label={techLevelLabel(tl)}
                  active={activeTechLevels.has(tl)}
                  onClick={() => toggleTechLevel(tl)}
                  colorClass={TECH_LEVEL_STYLES[String(tl)]}
                />
              ))}
            </div>
          )}

          {availableSources.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={allSourcesActive}
                onClick={() => setActiveSourceFilters(new Set())}
              />
              {availableSources.map((source) => (
                <FilterChip
                  key={source}
                  label={source}
                  active={activeSourceFilters.has(source)}
                  onClick={() => toggleSource(source)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Entity list */}
        <div
          className="flex flex-col gap-2 overflow-y-auto px-1 pr-3 [&>*]:ring-1 [&>*]:ring-su-black"
          style={{ scrollbarGutter: 'stable' }}
        >
          {selectable.length === 0 && overCapacity.length === 0 && overBudget.length === 0 ? (
            <p className="py-4 text-center text-sm text-su-grey-dark">No results found.</p>
          ) : (
            <>
              {selectable.map((entity) => {
                const id = getEntityId(entity)
                const isCurrent = currentEntityId !== undefined && id === currentEntityId
                return (
                  <div key={id} className={isCurrent ? 'ring-2 ring-su-green/50' : ''}>
                    <ReferenceEntityDisplay
                      data={entity}
                      compact
                      controls={isCurrent ? undefined : [addControl(() => handleSelect(id))]}
                    />
                  </div>
                )
              })}
              {overCapacity.length > 0 && (
                <>
                  <p className="mt-2 text-center text-xs font-medium text-su-grey-dark">
                    Over capacity ({overCapacity.length})
                  </p>
                  {overCapacity.map((entity) => {
                    const id = getEntityId(entity)
                    return (
                      <div
                        key={id}
                        className="pointer-events-none rounded-md opacity-50 ring-2 ring-su-rust/50"
                      >
                        <ReferenceEntityDisplay data={entity} compact disabled />
                      </div>
                    )
                  })}
                </>
              )}
              {overBudget.length > 0 && (
                <>
                  <p className="mt-2 text-center text-xs font-medium text-su-grey-dark">
                    Over budget ({overBudget.length})
                  </p>
                  {overBudget.map((entity) => {
                    const id = getEntityId(entity)
                    return (
                      <div
                        key={id}
                        className="pointer-events-none rounded-md opacity-50 ring-2 ring-su-rust/50"
                      >
                        <ReferenceEntityDisplay data={entity} compact disabled />
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
