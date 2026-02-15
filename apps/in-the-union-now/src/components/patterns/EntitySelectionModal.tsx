import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference, getTechLevel, getSource } from 'salvageunion-reference'
import {
  DisplayCard,
  EntityDisplay,
  Text,
  FilterChip,
  TECH_LEVEL_STYLES,
  techLevelLabel,
} from 'suref-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Input } from '../ui/input'

type SchemaName = 'chassis' | 'systems' | 'modules'

type TechLevelValue = number | 'B' | 'N'

type EntitySelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  schemaName: SchemaName
  onSelect: (entityId: string) => void
  filter?: (entity: { id: string; name: string }) => boolean
  remainingSlots?: number
}

function getEntities(schemaName: SchemaName): SURefEntity[] {
  switch (schemaName) {
    case 'chassis':
      return SalvageUnionReference.Chassis.all()
    case 'systems':
      return SalvageUnionReference.Systems.all()
    case 'modules':
      return SalvageUnionReference.Modules.all()
  }
}

function getSlotsRequired(entity: SURefEntity): number | undefined {
  if ('slotsRequired' in entity) return entity.slotsRequired as number
  return undefined
}

const ALL_TECH_LEVELS: TechLevelValue[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

export function EntitySelectionModal({
  open,
  onOpenChange,
  title,
  schemaName,
  onSelect,
  filter,
  remainingSlots,
}: EntitySelectionModalProps) {
  const [search, setSearch] = useState('')
  const [activeTechLevels, setActiveTechLevels] = useState<Set<TechLevelValue>>(
    () => new Set(ALL_TECH_LEVELS)
  )
  const [activeSourceFilters, setActiveSourceFilters] = useState<Set<string>>(new Set())

  const allEntities = useMemo(() => getEntities(schemaName), [schemaName])

  // Determine which tech levels exist in this schema's entities
  const availableTechLevels = useMemo(() => {
    const found = new Set<TechLevelValue>()
    for (const entity of allEntities) {
      const tl = getTechLevel(entity)
      if (tl !== undefined) found.add(tl as TechLevelValue)
    }
    return ALL_TECH_LEVELS.filter((tl) => found.has(tl))
  }, [allEntities])

  // Determine which sources exist in this schema's entities
  const availableSources = useMemo(() => {
    const found = new Set<string>()
    for (const entity of allEntities) {
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
  }, [allEntities])

  const allTechActive = availableTechLevels.every((tl) => activeTechLevels.has(tl))
  const allSourcesActive = activeSourceFilters.size === 0

  const toggleAllTech = useCallback(() => {
    setActiveTechLevels(allTechActive ? new Set() : new Set(ALL_TECH_LEVELS))
  }, [allTechActive])

  const toggleTechLevel = useCallback((tl: TechLevelValue) => {
    setActiveTechLevels((prev) => {
      const next = new Set(prev)
      if (next.has(tl)) {
        next.delete(tl)
      } else {
        next.add(tl)
      }
      return next
    })
  }, [])

  const toggleSource = useCallback((source: string) => {
    setActiveSourceFilters((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }, [])

  const { selectable, overCapacity } = useMemo(() => {
    let filtered = allEntities

    // External filter
    if (filter) {
      filtered = filtered.filter((e) =>
        filter({
          id: 'id' in e ? (e.id as string) : '',
          name: 'name' in e ? (e.name as string) : '',
        })
      )
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter((e) => {
        const name = 'name' in e ? (e.name as string) : ''
        return name.toLowerCase().includes(q)
      })
    }

    // Tech level filter
    filtered = filtered.filter((e) => {
      const tl = getTechLevel(e)
      if (tl === undefined) return true
      return activeTechLevels.has(tl as TechLevelValue)
    })

    // Source filter
    if (activeSourceFilters.size > 0) {
      filtered = filtered.filter((e) => {
        const src = getSource(e)
        if (!src) return true
        return activeSourceFilters.has(src)
      })
    }

    // Sort alphabetically
    filtered.sort((a, b) => {
      const nameA = 'name' in a ? (a.name as string) : ''
      const nameB = 'name' in b ? (b.name as string) : ''
      return nameA.localeCompare(nameB)
    })

    // Split by capacity
    if (remainingSlots === undefined) {
      return { selectable: filtered, overCapacity: [] }
    }

    const selectableItems: SURefEntity[] = []
    const overCapacityItems: SURefEntity[] = []

    for (const entity of filtered) {
      const slots = getSlotsRequired(entity)
      if (slots !== undefined && slots > remainingSlots) {
        overCapacityItems.push(entity)
      } else {
        selectableItems.push(entity)
      }
    }

    return { selectable: selectableItems, overCapacity: overCapacityItems }
  }, [allEntities, filter, search, activeTechLevels, activeSourceFilters, remainingSlots])

  const handleSelect = useCallback(
    (entityId: string) => {
      onSelect(entityId)
      onOpenChange(false)
      setSearch('')
      setActiveTechLevels(new Set(ALL_TECH_LEVELS))
      setActiveSourceFilters(new Set())
    },
    [onSelect, onOpenChange]
  )

  const handleClose = useCallback(
    (next: boolean) => {
      onOpenChange(next)
      if (!next) {
        setSearch('')
        setActiveTechLevels(new Set(ALL_TECH_LEVELS))
        setActiveSourceFilters(new Set())
      }
    },
    [onOpenChange]
  )

  const singularName = schemaName === 'chassis' ? 'chassis' : schemaName.slice(0, -1)
  const slotsLabel =
    remainingSlots !== undefined
      ? ` (${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining)`
      : ''

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-3xl bg-transparent outline-none">
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Select a {singularName} to add.{slotsLabel}
              </DialogPrimitive.Description>

              <DisplayCard
                headerBg="bg-su-orange"
                bodyPadding="p-0"
                headerContent={
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Text
                        as="span"
                        variant="pseudoheader"
                        className="text-[1.75rem] text-su-white"
                      >
                        {title}
                      </Text>
                      <Text as="span" variant="pseudoheader" className="text-xs text-su-white/80">
                        Select a {singularName} to add.{slotsLabel}
                      </Text>
                    </div>
                    <DialogPrimitive.Close className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-black/60 transition-colors hover:bg-su-black/20 hover:text-su-black">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                }
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
                    {selectable.length === 0 && overCapacity.length === 0 ? (
                      <p className="py-4 text-center text-sm text-su-grey-dark">
                        No results found.
                      </p>
                    ) : (
                      <>
                        {selectable.map((entity) => {
                          const id = 'id' in entity ? (entity.id as string) : ''
                          return (
                            <EntityDisplay
                              key={id}
                              data={entity}
                              compact
                              onAdd={() => handleSelect(id)}
                            />
                          )
                        })}
                        {overCapacity.length > 0 && (
                          <>
                            <p className="mt-2 text-center text-xs font-medium text-su-grey-dark">
                              Over capacity ({overCapacity.length})
                            </p>
                            {overCapacity.map((entity) => {
                              const id = 'id' in entity ? (entity.id as string) : ''
                              return (
                                <div
                                  key={id}
                                  className="pointer-events-none rounded-md opacity-50 ring-2 ring-su-rust/50"
                                >
                                  <EntityDisplay data={entity} compact disabled />
                                </div>
                              )
                            })}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </DisplayCard>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
