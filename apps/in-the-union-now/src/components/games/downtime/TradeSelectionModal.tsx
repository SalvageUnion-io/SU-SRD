import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference, getTechLevel, getSource } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  FilterChip,
  TECH_LEVEL_STYLES,
  techLevelLabel,
  addControl,
  Text,
} from 'suref-react'
import { Check } from 'lucide-react'
import { Input } from '../../ui/input'
import { FilterRow } from '../../shared/FilterRow'
import { ModalShell } from '../../shared/ModalShell'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs'
import {
  filterAndSplitEntities,
  ALL_TECH_LEVELS,
  getEntityId,
} from '../../../lib/entitySelectionUtils'
import type { TechLevelValue } from '../../../lib/entitySelectionUtils'
import { filterByTechLevel } from '../../../lib/tradeUtils'
import type { TradeCategory } from '../../../lib/tradeUtils'

type TradeSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: TradeCategory
  crawlerTL: number
  onSelect: (selections: {
    selected_chassis?: string
    selected_system?: string
    selected_module?: string
  }) => void
}

export function TradeSelectionModal({
  open,
  onOpenChange,
  category,
  crawlerTL,
  onSelect,
}: TradeSelectionModalProps) {
  if (category === 'nothing') return null

  if (category === 'systems-and-modules') {
    return (
      <TabbedTradeModal
        open={open}
        onOpenChange={onOpenChange}
        crawlerTL={crawlerTL}
        onSelect={onSelect}
      />
    )
  }

  return (
    <SingleSchemaTradeModal
      open={open}
      onOpenChange={onOpenChange}
      category={category}
      crawlerTL={crawlerTL}
      onSelect={onSelect}
    />
  )
}

// ---------------------------------------------------------------------------
// Single-schema picker (chassis, systems, or modules)
// ---------------------------------------------------------------------------

function SingleSchemaTradeModal({
  open,
  onOpenChange,
  category,
  crawlerTL,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: 'chassis' | 'systems' | 'modules'
  crawlerTL: number
  onSelect: TradeSelectionModalProps['onSelect']
}) {
  const schemaName = category
  const title =
    category === 'chassis'
      ? 'Select Chassis'
      : category === 'systems'
        ? 'Select System'
        : 'Select Module'

  const entities = useMemo(() => {
    const all = SalvageUnionReference.findAllIn(schemaName, () => true) as SURefEntity[]
    return filterByTechLevel(
      all as (SURefEntity & { techLevel?: number | string })[],
      crawlerTL
    ) as SURefEntity[]
  }, [schemaName, crawlerTL])

  const handleSelect = useCallback(
    (entityId: string) => {
      const key =
        category === 'chassis'
          ? 'selected_chassis'
          : category === 'systems'
            ? 'selected_system'
            : 'selected_module'
      onSelect({ [key]: entityId })
      onOpenChange(false)
    },
    [category, onSelect, onOpenChange]
  )

  return (
    <EntityPickerContent
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      entities={entities}
      onSelect={handleSelect}
    />
  )
}

// ---------------------------------------------------------------------------
// Tabbed picker for systems + modules (roll 11-19)
// ---------------------------------------------------------------------------

function TabbedTradeModal({
  open,
  onOpenChange,
  crawlerTL,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  crawlerTL: number
  onSelect: TradeSelectionModalProps['onSelect']
}) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  const systems = useMemo(() => {
    const all = SalvageUnionReference.findAllIn('systems', () => true) as SURefEntity[]
    return filterByTechLevel(
      all as (SURefEntity & { techLevel?: number | string })[],
      crawlerTL
    ) as SURefEntity[]
  }, [crawlerTL])

  const modules = useMemo(() => {
    const all = SalvageUnionReference.findAllIn('modules', () => true) as SURefEntity[]
    return filterByTechLevel(
      all as (SURefEntity & { techLevel?: number | string })[],
      crawlerTL
    ) as SURefEntity[]
  }, [crawlerTL])

  const handleConfirm = useCallback(() => {
    if (!selectedSystem || !selectedModule) return
    onSelect({ selected_system: selectedSystem, selected_module: selectedModule })
    onOpenChange(false)
  }, [selectedSystem, selectedModule, onSelect, onOpenChange])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSelectedSystem(null)
        setSelectedModule(null)
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const selectedSystemEntity = useMemo(
    () => (selectedSystem ? systems.find((s) => getEntityId(s) === selectedSystem) : null),
    [selectedSystem, systems]
  )
  const selectedModuleEntity = useMemo(
    () => (selectedModule ? modules.find((m) => getEntityId(m) === selectedModule) : null),
    [selectedModule, modules]
  )

  return (
    <ModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Select System & Module"
      subtitle="Choose one of each"
      description="Select one system and one module for trade."
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Selection summary */}
        <div className="flex gap-2 text-xs">
          <span className={selectedSystem ? 'text-su-green font-medium' : 'text-su-grey-dark'}>
            {selectedSystemEntity ? `System: ${selectedSystemEntity.name}` : 'No system selected'}
          </span>
          <span className="text-su-grey-light">|</span>
          <span className={selectedModule ? 'text-su-green font-medium' : 'text-su-grey-dark'}>
            {selectedModuleEntity ? `Module: ${selectedModuleEntity.name}` : 'No module selected'}
          </span>
        </div>

        <Tabs defaultValue="systems">
          <TabsList className="w-full">
            <TabsTrigger value="systems" className="flex-1">
              Systems {selectedSystem && <Check className="ml-1 inline h-3 w-3 text-su-green" />}
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex-1">
              Modules {selectedModule && <Check className="ml-1 inline h-3 w-3 text-su-green" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="systems">
            <FilterableEntityList
              entities={systems}
              selectedId={selectedSystem}
              onSelect={setSelectedSystem}
            />
          </TabsContent>
          <TabsContent value="modules">
            <FilterableEntityList
              entities={modules}
              selectedId={selectedModule}
              onSelect={setSelectedModule}
            />
          </TabsContent>
        </Tabs>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedSystem || !selectedModule}
          className="flex w-full cursor-pointer items-center justify-center gap-2 bg-su-green px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            Confirm Selection
          </Text>
        </button>
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Shared filterable entity list (used inside both single and tabbed modals)
// ---------------------------------------------------------------------------

function FilterableEntityList({
  entities,
  selectedId,
  onSelect,
}: {
  entities: SURefEntity[]
  selectedId: string | null
  onSelect: (id: string) => void
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
            const isSelected = id === selectedId
            return (
              <div key={id} className={isSelected ? 'ring-2 ring-su-green/50' : ''}>
                <ReferenceEntityDisplay
                  data={entity}
                  compact
                  controls={
                    isSelected
                      ? undefined
                      : [{ ...addControl(() => onSelect(id)), hidden: false, cardClick: false }]
                  }
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable single-schema picker wrapper (using ModalShell + FilterableEntityList)
// ---------------------------------------------------------------------------

function EntityPickerContent({
  open,
  onOpenChange,
  title,
  entities,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  entities: SURefEntity[]
  onSelect: (entityId: string) => void
}) {
  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next)
    },
    [onOpenChange]
  )

  return (
    <ModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={`Select an item from ${title}.`}
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        <FilterableEntityList
          entities={entities}
          selectedId={null}
          onSelect={(id) => {
            onSelect(id)
          }}
        />
      </div>
    </ModalShell>
  )
}
