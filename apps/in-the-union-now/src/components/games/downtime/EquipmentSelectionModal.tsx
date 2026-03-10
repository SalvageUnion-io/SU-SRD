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
import { Input } from '../../ui/input'
import { FilterRow, ModalShell } from 'suref-react'
import {
  filterAndSplitEntities,
  ALL_TECH_LEVELS,
  getEntityId,
} from '../../../lib/entitySelectionUtils'
import type { TechLevelValue } from '../../../lib/entitySelectionUtils'
import { getAvailableEquipment } from '../../../lib/equipmentUtils'

type EquipmentSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  crawlerTL: number
  onSelect: (entity: SURefEntity) => void
}

export function EquipmentSelectionModal({
  open,
  onOpenChange,
  crawlerTL,
  onSelect,
}: EquipmentSelectionModalProps) {
  const entities = useMemo(() => getAvailableEquipment(crawlerTL), [crawlerTL])

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Choose Pilot Equipment"
      subtitle="1 piece per downtime"
      description="Select one piece of pilot equipment."
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        <FilterableEquipmentList entities={entities} onSelect={onSelect} />
      </div>
    </ModalShell>
  )
}

function FilterableEquipmentList({
  entities,
  onSelect,
}: {
  entities: SURefEntity[]
  onSelect: (entity: SURefEntity) => void
}) {
  const [search, setSearch] = useState('')
  const [activeTechLevels, setActiveTechLevels] = useState<Set<TechLevelValue>>(new Set())
  const [activeSourceFilters, setActiveSourceFilters] = useState<Set<string>>(new Set())

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
    return [...found].sort()
  }, [entities])

  const toggleTechLevel = useCallback(
    (tl: TechLevelValue) => {
      setActiveTechLevels((prev) => {
        if (prev.size === 0) return new Set([tl])
        const next = new Set(prev)
        if (next.has(tl)) next.delete(tl)
        else next.add(tl)
        if (availableTechLevels.every((t) => next.has(t))) return new Set()
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

  const { selectable } = useMemo(
    () =>
      filterAndSplitEntities({
        entities,
        search,
        activeTechLevels,
        activeSourceFilters,
      }),
    [entities, search, activeTechLevels, activeSourceFilters]
  )

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-su-grey-light/50 bg-su-white text-su-black placeholder:text-su-grey-dark"
      />

      {availableTechLevels.length > 1 && (
        <FilterRow label="Tech Level" gap="gap-1.5">
          <FilterChip
            label="All"
            active={activeTechLevels.size === 0}
            onClick={() => setActiveTechLevels(new Set())}
          />
          {availableTechLevels.map((tl) => (
            <FilterChip
              key={String(tl)}
              label={techLevelLabel(tl)}
              active={activeTechLevels.has(tl)}
              onClick={() => toggleTechLevel(tl)}
              colorClass={TECH_LEVEL_STYLES[String(tl)]}
            />
          ))}
        </FilterRow>
      )}

      {availableSources.length > 1 && (
        <FilterRow label="Source" gap="gap-1.5">
          <FilterChip
            label="All"
            active={activeSourceFilters.size === 0}
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
        </FilterRow>
      )}

      <div
        className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto px-1 py-1 pr-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {selectable.length === 0 ? (
          <p className="py-4 text-center text-sm text-su-grey-dark">No results found.</p>
        ) : (
          selectable.map((entity) => {
            const id = getEntityId(entity)
            return (
              <div key={id}>
                <ReferenceEntityDisplay
                  data={entity}
                  compact
                  controls={[
                    { ...addControl(() => onSelect(entity)), hidden: false, cardClick: false },
                  ]}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
