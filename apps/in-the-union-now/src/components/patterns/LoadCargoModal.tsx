import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference, getTechLevel, getSalvageValue } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  FilterChip,
  TECH_LEVEL_STYLES,
  techLevelLabel,
  addControl,
} from 'suref-react'
import { ModalShell } from '../shared/ModalShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Input } from '../ui/input'
import { FilterRow } from '../shared/FilterRow'
import {
  filterAndSplitEntities,
  ALL_TECH_LEVELS,
  getEntityId,
} from '../../lib/entitySelectionUtils'
import type { TechLevelValue } from '../../lib/entitySelectionUtils'

type LoadCargoModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  remainingCapacity: number
  onAddEntity: (schemaName: string, entityId: string, name: string, salvageValue: number) => void
  onAddCustom: (name: string, techLevel: string | undefined, salvageValue: number) => void
  onAddScrap: (techLevel: number, quantity: number) => void
  isAdding?: boolean
}

const CARGO_SCHEMAS = ['systems', 'modules', 'chassis'] as const

type CargoSchemaFilter = (typeof CARGO_SCHEMAS)[number]

const SCHEMA_LABELS: Record<CargoSchemaFilter, string> = {
  systems: 'Systems',
  modules: 'Modules',
  chassis: 'Chassis',
}

export function LoadCargoModal({
  open,
  onOpenChange,
  remainingCapacity,
  onAddEntity,
  onAddCustom,
  onAddScrap,
  isAdding,
}: LoadCargoModalProps) {
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
      title="Load Cargo"
      subtitle={`${remainingCapacity} capacity remaining`}
      description="Add items to mech cargo hold"
    >
      <Tabs defaultValue="entity" className="bg-su-white">
        <TabsList className="w-full rounded-none border-b border-su-grey-light/30 bg-su-white p-0">
          <TabsTrigger
            value="entity"
            className="flex-1 rounded-none border-b-2 border-transparent py-2 font-mono text-xs font-bold uppercase tracking-wide text-su-black/50 data-[state=active]:border-su-green data-[state=active]:text-su-black data-[state=active]:shadow-none"
          >
            Entity
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="flex-1 rounded-none border-b-2 border-transparent py-2 font-mono text-xs font-bold uppercase tracking-wide text-su-black/50 data-[state=active]:border-su-green data-[state=active]:text-su-black data-[state=active]:shadow-none"
          >
            Custom
          </TabsTrigger>
          <TabsTrigger
            value="scrap"
            className="flex-1 rounded-none border-b-2 border-transparent py-2 font-mono text-xs font-bold uppercase tracking-wide text-su-black/50 data-[state=active]:border-su-green data-[state=active]:text-su-black data-[state=active]:shadow-none"
          >
            Scrap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entity" className="mt-0">
          <EntityTab
            remainingCapacity={remainingCapacity}
            onAddEntity={onAddEntity}
            isAdding={isAdding}
          />
        </TabsContent>

        <TabsContent value="custom" className="mt-0">
          <CustomTab
            remainingCapacity={remainingCapacity}
            onAddCustom={onAddCustom}
            isAdding={isAdding}
          />
        </TabsContent>

        <TabsContent value="scrap" className="mt-0">
          <ScrapTab
            remainingCapacity={remainingCapacity}
            onAddScrap={onAddScrap}
            isAdding={isAdding}
          />
        </TabsContent>
      </Tabs>
    </ModalShell>
  )
}

// --- Entity Tab ---

function EntityTab({
  remainingCapacity,
  onAddEntity,
  isAdding,
}: {
  remainingCapacity: number
  onAddEntity: (schemaName: string, entityId: string, name: string, salvageValue: number) => void
  isAdding?: boolean
}) {
  const [search, setSearch] = useState('')
  const [activeTechLevels, setActiveTechLevels] = useState<Set<TechLevelValue>>(new Set())
  const [activeSchemas, setActiveSchemas] = useState<Set<CargoSchemaFilter>>(new Set())

  const allEntities = useMemo(() => {
    const schemas = activeSchemas.size > 0 ? [...activeSchemas] : [...CARGO_SCHEMAS]
    const entities: SURefEntity[] = []
    for (const schema of schemas) {
      if (schema === 'systems') entities.push(...SalvageUnionReference.Systems.all())
      if (schema === 'modules') entities.push(...SalvageUnionReference.Modules.all())
      if (schema === 'chassis') entities.push(...SalvageUnionReference.Chassis.all())
    }
    return entities
  }, [activeSchemas])

  const availableTechLevels = useMemo(() => {
    const found = new Set<TechLevelValue>()
    for (const entity of allEntities) {
      const tl = getTechLevel(entity)
      if (tl !== undefined) found.add(tl as TechLevelValue)
    }
    return ALL_TECH_LEVELS.filter((tl) => found.has(tl))
  }, [allEntities])

  const { selectable, overBudget } = useMemo(
    () =>
      filterAndSplitEntities({
        entities: allEntities,
        search,
        activeTechLevels,
        activeSourceFilters: new Set(),
        remainingBudget: remainingCapacity,
      }),
    [allEntities, search, activeTechLevels, remainingCapacity]
  )

  const toggleSchema = useCallback((schema: CargoSchemaFilter) => {
    setActiveSchemas((prev) => {
      if (prev.size === 0) return new Set([schema])
      const next = new Set(prev)
      if (next.has(schema)) next.delete(schema)
      else next.add(schema)
      if (CARGO_SCHEMAS.every((s) => next.has(s))) return new Set()
      return next
    })
  }, [])

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

  const handleSelect = useCallback(
    (entity: SURefEntity) => {
      const id = getEntityId(entity)
      const name = 'name' in entity ? (entity.name as string) : id
      const sv = getSalvageValue(entity) ?? 1
      const schemaName = 'schemaName' in entity ? (entity.schemaName as string) : 'systems'
      onAddEntity(schemaName, id, name, sv)
    },
    [onAddEntity]
  )

  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-hidden p-3">
      {/* Filters */}
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-su-grey-light/50 bg-su-white text-su-black placeholder:text-su-grey-dark"
        />

        <FilterRow label="Schema" gap="gap-1.5">
          <FilterChip
            label="All"
            active={activeSchemas.size === 0}
            onClick={() => setActiveSchemas(new Set())}
          />
          {CARGO_SCHEMAS.map((schema) => (
            <FilterChip
              key={schema}
              label={SCHEMA_LABELS[schema]}
              active={activeSchemas.has(schema)}
              onClick={() => toggleSchema(schema)}
            />
          ))}
        </FilterRow>

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
      </div>

      {/* Entity list */}
      <div
        className="flex flex-col gap-2 overflow-y-auto px-1 py-1 pr-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {selectable.length === 0 && overBudget.length === 0 ? (
          <p className="py-4 text-center text-sm text-su-grey-dark">No results found.</p>
        ) : (
          <>
            {selectable.map((entity) => {
              const id = getEntityId(entity)
              return (
                <div key={id}>
                  <ReferenceEntityDisplay
                    data={entity}
                    compact
                    controls={[
                      {
                        ...addControl(() => handleSelect(entity)),
                        hidden: false,
                        cardClick: false,
                      },
                    ]}
                    disabled={isAdding}
                  />
                </div>
              )
            })}
            {overBudget.length > 0 && (
              <>
                <p className="mt-2 text-center text-xs font-medium text-su-grey-dark">
                  Over capacity ({overBudget.length})
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
  )
}

// --- Custom Tab ---

const TL_OPTIONS: (number | 'B' | 'N')[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

function CustomTab({
  remainingCapacity,
  onAddCustom,
  isAdding,
}: {
  remainingCapacity: number
  onAddCustom: (name: string, techLevel: string | undefined, salvageValue: number) => void
  isAdding?: boolean
}) {
  const [name, setName] = useState('')
  const [techLevel, setTechLevel] = useState<string | undefined>(undefined)
  const [salvageValue, setSalvageValue] = useState('')

  const svNum = salvageValue ? Number(salvageValue) : 0
  const isValid = name.trim().length > 0 && svNum >= 1 && svNum <= remainingCapacity

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid) return
      onAddCustom(name.trim(), techLevel, svNum)
      setName('')
      setTechLevel(undefined)
      setSalvageValue('')
    },
    [name, techLevel, svNum, isValid, onAddCustom]
  )

  const inputClasses =
    'h-9 border-su-grey-dark/40 bg-su-white text-su-black placeholder:text-su-grey-dark'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cargo-custom-name"
          className="text-xs font-bold uppercase tracking-wide text-su-black/70"
        >
          Name *
        </label>
        <Input
          id="cargo-custom-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className={inputClasses}
        />
      </div>

      {/* Tech Level */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-su-black/70">
          Tech Level
        </span>
        <div className="flex flex-wrap gap-1">
          {TL_OPTIONS.map((tl) => {
            const key = String(tl)
            return (
              <FilterChip
                key={key}
                label={techLevelLabel(tl)}
                active={techLevel === key}
                onClick={() => setTechLevel(techLevel === key ? undefined : key)}
                colorClass={TECH_LEVEL_STYLES[key]?.split(' ')[0]}
              />
            )
          })}
        </div>
      </div>

      {/* Salvage Value */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cargo-custom-sv"
          className="text-xs font-bold uppercase tracking-wide text-su-black/70"
        >
          Salvage Value *{' '}
          <span className="font-normal text-su-black/40">(max {remainingCapacity})</span>
        </label>
        <Input
          id="cargo-custom-sv"
          type="number"
          min={1}
          max={remainingCapacity}
          value={salvageValue}
          onChange={(e) => setSalvageValue(e.target.value)}
          placeholder="1"
          className={`w-32 ${inputClasses}`}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-2 border-t border-su-grey-light/30 pt-3">
        <button
          type="submit"
          disabled={!isValid || isAdding}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
        >
          {isAdding ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// --- Scrap Tab ---

const SCRAP_TL_OPTIONS = [1, 2, 3, 4, 5, 6] as const

function ScrapTab({
  remainingCapacity,
  onAddScrap,
  isAdding,
}: {
  remainingCapacity: number
  onAddScrap: (techLevel: number, quantity: number) => void
  isAdding?: boolean
}) {
  const [techLevel, setTechLevel] = useState<number | undefined>(undefined)
  const [quantity, setQuantity] = useState('')

  const qtyNum = quantity ? Number(quantity) : 0
  const isValid = techLevel !== undefined && qtyNum >= 1 && qtyNum <= remainingCapacity

  const preview = techLevel !== undefined && qtyNum >= 1 ? `${qtyNum}TL${techLevel} Scrap` : null

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid || techLevel === undefined) return
      onAddScrap(techLevel, qtyNum)
      setTechLevel(undefined)
      setQuantity('')
    },
    [techLevel, qtyNum, isValid, onAddScrap]
  )

  const inputClasses =
    'h-9 border-su-grey-dark/40 bg-su-white text-su-black placeholder:text-su-grey-dark'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* Tech Level */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-su-black/70">
          Tech Level *
        </span>
        <div className="flex flex-wrap gap-1">
          {SCRAP_TL_OPTIONS.map((tl) => (
            <FilterChip
              key={tl}
              label={techLevelLabel(tl)}
              active={techLevel === tl}
              onClick={() => setTechLevel(techLevel === tl ? undefined : tl)}
              colorClass={TECH_LEVEL_STYLES[String(tl)]?.split(' ')[0]}
            />
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cargo-scrap-qty"
          className="text-xs font-bold uppercase tracking-wide text-su-black/70"
        >
          Quantity * <span className="font-normal text-su-black/40">(max {remainingCapacity})</span>
        </label>
        <Input
          id="cargo-scrap-qty"
          type="number"
          min={1}
          max={remainingCapacity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="1"
          className={`w-32 ${inputClasses}`}
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded border border-su-grey-light/40 bg-su-sand/30 px-3 py-2">
          <span className="font-mono text-sm font-bold text-su-black">{preview}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-2 border-t border-su-grey-light/30 pt-3">
        <button
          type="submit"
          disabled={!isValid || isAdding}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
        >
          {isAdding ? 'Adding...' : 'Add Scrap'}
        </button>
      </div>
    </form>
  )
}
