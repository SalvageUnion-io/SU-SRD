import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getSalvageValue } from 'salvageunion-reference'
import { ReferenceEntityDisplay, FilterChip, TECH_LEVEL_STYLES, techLevelLabel } from 'suref-react'
import { Hammer } from 'lucide-react'
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
import { getCraftableEntities, canAffordCraft } from '../../../lib/craftUtils'
import { getScrapAtTL } from '../../../lib/upkeepUtils'
import type { CrawlerScrap } from '../../../lib/upkeepUtils'

type CraftSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  crawlerTL: number
  availableScrap: CrawlerScrap
  onCraft: (entity: SURefEntity, schemaName: 'chassis' | 'systems' | 'modules') => void
}

export function CraftSelectionModal({
  open,
  onOpenChange,
  crawlerTL,
  availableScrap,
  onCraft,
}: CraftSelectionModalProps) {
  const chassis = useMemo(() => getCraftableEntities('chassis', crawlerTL), [crawlerTL])
  const systems = useMemo(() => getCraftableEntities('systems', crawlerTL), [crawlerTL])
  const modules = useMemo(() => getCraftableEntities('modules', crawlerTL), [crawlerTL])

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Crafting"
      subtitle="Costs salvage value in scrap at item TL"
      description="Craft chassis, systems, or modules using scrap."
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Scrap summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4, 5, 6].map((tl) => {
            const amount = getScrapAtTL(availableScrap, tl)
            if (amount <= 0) return null
            return (
              <span key={tl} className="text-su-grey-dark">
                TL{tl}: <strong className="text-su-black">{amount}</strong>
              </span>
            )
          })}
        </div>

        <Tabs defaultValue="systems">
          <TabsList className="w-full">
            <TabsTrigger value="chassis" className="flex-1">
              Chassis
            </TabsTrigger>
            <TabsTrigger value="systems" className="flex-1">
              Systems
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex-1">
              Modules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chassis">
            <CraftEntityList
              entities={chassis}
              schemaName="chassis"
              availableScrap={availableScrap}
              onCraft={onCraft}
            />
          </TabsContent>
          <TabsContent value="systems">
            <CraftEntityList
              entities={systems}
              schemaName="systems"
              availableScrap={availableScrap}
              onCraft={onCraft}
            />
          </TabsContent>
          <TabsContent value="modules">
            <CraftEntityList
              entities={modules}
              schemaName="modules"
              availableScrap={availableScrap}
              onCraft={onCraft}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ModalShell>
  )
}

function CraftEntityList({
  entities,
  schemaName,
  availableScrap,
  onCraft,
}: {
  entities: SURefEntity[]
  schemaName: 'chassis' | 'systems' | 'modules'
  availableScrap: CrawlerScrap
  onCraft: (entity: SURefEntity, schema: 'chassis' | 'systems' | 'modules') => void
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
            const cost = getSalvageValue(entity) ?? 0
            const tl =
              'techLevel' in entity && typeof entity.techLevel === 'number' ? entity.techLevel : 1
            const affordable = canAffordCraft(availableScrap, cost, tl)

            return (
              <div key={id} className={affordable ? '' : 'pointer-events-none opacity-40'}>
                <ReferenceEntityDisplay
                  data={entity}
                  compact
                  subtitleExtra={
                    <span className="text-[10px] text-su-grey-dark">
                      Cost: {cost} TL{tl} scrap
                    </span>
                  }
                  controls={
                    affordable
                      ? [
                          {
                            key: 'craft',
                            icon: (props: { className?: string }) => <Hammer {...props} />,
                            onClick: () => onCraft(entity, schemaName),
                            ariaLabel: `Craft ${entity.name}`,
                          },
                        ]
                      : undefined
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
