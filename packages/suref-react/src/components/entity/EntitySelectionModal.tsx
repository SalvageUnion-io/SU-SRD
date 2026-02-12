import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { SalvageUnionReference, getTechLevel, getTechLevelNumber } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { EntityDisplay } from './EntityDisplay'
import { TECH_LEVELS } from '../../constants/gameRules'
import { Text } from '../base/Text'
import { cn } from '../../utils/cn'

// Estimated height for an expanded EntityDisplay item
const ESTIMATED_ITEM_HEIGHT = 300

type EntitySelectionModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Array of schema names to search from (e.g., ['equipment', 'modules']) */
  schemaNames: SURefEnumSchemaName[] | undefined
  /** Callback when an entity is selected - receives the entity ID and schema name */
  onSelect: (entityId: string, schemaName: SURefEnumSchemaName) => void
  /** Modal title */
  title?: string
  /** Prefix for select button text (e.g., "Equip", "Select", "Add") */
  selectButtonTextPrefix?: string
  /** Optional function to determine if an entity should be disabled */
  shouldDisableEntity?: (entity: SURefEntity) => boolean
  /** Optional selected entity ID (for showing selected state) */
  selectedEntityId?: string | null
  /** Optional selected entity schema name (required if selectedEntityId is provided) */
  selectedEntitySchemaName?: SURefEnumSchemaName
  /** Whether to hide chassis patterns in entity displays */
  hidePatterns?: boolean
}

export function EntitySelectionModal({
  isOpen,
  onClose,
  schemaNames = [],
  onSelect,
  title = 'Select Item',
  selectButtonTextPrefix = 'Select',
  shouldDisableEntity,
  selectedEntityId,
  selectedEntitySchemaName,
  hidePatterns = false,
}: EntitySelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSearchTerm, setFilterSearchTerm] = useState('')
  const [techLevelFilter, setTechLevelFilter] = useState<number | 'B' | 'N' | null>(null)
  const [schemaFilter, setSchemaFilter] = useState<SURefEnumSchemaName | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Update filter search term with debounce, but keep input immediate
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setFilterSearchTerm(searchTerm)
    }, 150)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchTerm])

  const allEntities = useMemo(() => {
    const entities: Array<{ entity: SURefEntity; schemaName: SURefEnumSchemaName }> = []

    schemaNames.forEach((schemaName) => {
      const items = SalvageUnionReference.findAllIn(schemaName, () => true)
      items.forEach((item) => {
        entities.push({ entity: item, schemaName })
      })
    })

    return entities
  }, [schemaNames])

  const getEntityTechLevel = (entity: SURefEntity): number | 'B' | 'N' | null => {
    return getTechLevel(entity) ?? null
  }

  const disabledEntities = useMemo(() => {
    if (!shouldDisableEntity) return new Set<string>()

    const disabled = new Set<string>()
    allEntities.forEach(({ entity, schemaName }) => {
      const entityId = 'id' in entity ? (entity.id as string) : ''
      if (shouldDisableEntity(entity)) {
        disabled.add(`${schemaName}-${entityId}`)
      }
    })
    return disabled
  }, [allEntities, shouldDisableEntity])

  const filteredEntities = useMemo(() => {
    return allEntities
      .filter(({ entity, schemaName }) => {
        const isIndexable = 'indexable' in entity ? entity.indexable !== false : true

        const matchesSearch =
          !filterSearchTerm ||
          ('name' in entity &&
            typeof entity.name === 'string' &&
            entity.name.toLowerCase().includes(filterSearchTerm.toLowerCase())) ||
          ('description' in entity &&
            typeof entity.description === 'string' &&
            entity.description.toLowerCase().includes(filterSearchTerm.toLowerCase()))

        const entityTechLevel = getEntityTechLevel(entity)
        const matchesTechLevel =
          techLevelFilter === null ||
          entityTechLevel === null ||
          entityTechLevel === techLevelFilter

        const matchesSchema = schemaFilter === null || schemaName === schemaFilter

        return isIndexable && matchesSearch && matchesTechLevel && matchesSchema
      })
      .sort((a, b) => {
        const aId = 'id' in a.entity ? (a.entity.id as string) : ''
        const bId = 'id' in b.entity ? (b.entity.id as string) : ''
        const aDisabled = disabledEntities.has(`${a.schemaName}-${aId}`)
        const bDisabled = disabledEntities.has(`${b.schemaName}-${bId}`)

        if (aDisabled !== bDisabled) {
          return aDisabled ? 1 : -1
        }

        const aTechLevel = getTechLevelNumber(a.entity) ?? 0
        const bTechLevel = getTechLevelNumber(b.entity) ?? 0

        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }

        const aName = 'name' in a.entity ? (a.entity.name as string) : ''
        const bName = 'name' in b.entity ? (b.entity.name as string) : ''
        return aName.localeCompare(bName)
      })
  }, [allEntities, filterSearchTerm, techLevelFilter, schemaFilter, disabledEntities])

  const handleSelect = useCallback(
    (entityId: string, schemaName: SURefEnumSchemaName) => {
      onSelect(entityId, schemaName)
      onClose()
    },
    [onSelect, onClose]
  )

  const showTechLevelFilter = useMemo(() => {
    if (!schemaNames || schemaNames.length === 0) return false

    return allEntities.some(({ entity }) => getEntityTechLevel(entity) !== null)
  }, [schemaNames, allEntities])

  const isFiltering = searchTerm !== filterSearchTerm

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filteredEntities.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 10,
  })

  return (
    <Dialog
      key={isOpen ? 'open' : 'closed'}
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden border-3 border-su-black bg-su-grey-medium p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Select an entity</DialogDescription>
        <div className="flex h-[80vh] flex-col items-stretch gap-0 overflow-hidden">
          {/* Header / filters */}
          <div className="flex w-full shrink-0 flex-col items-stretch gap-4 border-b border-su-black bg-su-grey-medium px-6 pt-4 pb-4">
            <Text variant="pseudoheader" className="mt-2 text-4xl uppercase">
              {title}
            </Text>
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border-2 border-su-black bg-su-white px-4 py-2 text-su-black"
              />
              {isFiltering && (
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-su-orange border-t-transparent" />
              )}
            </div>

            <div className="flex w-full flex-wrap items-start justify-between gap-4">
              {showTechLevelFilter && (
                <div className="flex flex-wrap gap-1">
                  {TECH_LEVELS.map((tl) => (
                    <button
                      key={tl}
                      onClick={() => setTechLevelFilter(tl === techLevelFilter ? null : tl)}
                      className={cn(
                        'cursor-pointer rounded-md px-3 py-2 text-sm font-bold',
                        techLevelFilter === tl
                          ? 'bg-su-orange text-su-white'
                          : 'bg-su-blue-light text-su-black'
                      )}
                    >
                      TL{tl}
                    </button>
                  ))}
                  <button
                    onClick={() => setTechLevelFilter('B' === techLevelFilter ? null : 'B')}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-2 text-sm font-bold',
                      techLevelFilter === 'B'
                        ? 'bg-su-orange text-su-white'
                        : 'bg-su-blue-light text-su-black'
                    )}
                  >
                    Bio
                  </button>
                  <button
                    onClick={() => setTechLevelFilter('N' === techLevelFilter ? null : 'N')}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-2 text-sm font-bold',
                      techLevelFilter === 'N'
                        ? 'bg-su-orange text-su-white'
                        : 'bg-su-blue-light text-su-black'
                    )}
                  >
                    N
                  </button>
                  <button
                    onClick={() => setTechLevelFilter(null)}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-2 text-sm font-bold',
                      techLevelFilter === null
                        ? 'bg-su-orange text-su-white'
                        : 'bg-su-blue-light text-su-black'
                    )}
                  >
                    All
                  </button>
                </div>
              )}

              {schemaNames.length > 1 && (
                <div className="flex flex-wrap justify-end gap-2">
                  {schemaNames.map((schema) => (
                    <button
                      key={schema}
                      onClick={() => setSchemaFilter(schema)}
                      className={cn(
                        'cursor-pointer rounded-md px-3 py-2 text-sm font-bold capitalize',
                        schemaFilter === schema
                          ? 'bg-su-orange text-su-white'
                          : 'bg-su-blue-light text-su-black'
                      )}
                    >
                      {schema.replace(/-/g, ' ')}
                    </button>
                  ))}
                  <button
                    onClick={() => setSchemaFilter(null)}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-2 text-sm font-bold',
                      schemaFilter === null
                        ? 'bg-su-orange text-su-white'
                        : 'bg-su-blue-light text-su-black'
                    )}
                  >
                    All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable entity list */}
          <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4">
            {filteredEntities.length === 0 ? (
              <p className="py-8 text-center text-su-black">
                No items found matching your criteria.
              </p>
            ) : (
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const item = filteredEntities[virtualItem.index]
                  if (!item) return null

                  const { entity, schemaName } = item
                  const entityId = 'id' in entity ? (entity.id as string) : ''
                  const isDisabled = shouldDisableEntity ? shouldDisableEntity(entity) : false
                  const isSelected =
                    selectedEntityId !== undefined &&
                    selectedEntityId !== null &&
                    selectedEntityId === entityId &&
                    selectedEntitySchemaName === schemaName

                  const entityName = 'name' in entity ? (entity.name as string) : 'Unknown'
                  const buttonText = `${selectButtonTextPrefix} ${entityName}`

                  return (
                    <div
                      key={`${schemaName}-${entityId}`}
                      className="absolute top-0 left-0 w-full px-2 pb-4"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                      data-index={virtualItem.index}
                      ref={(node: HTMLDivElement | null) => {
                        if (node) {
                          virtualizer.measureElement(node)
                        }
                      }}
                    >
                      <EntityDisplay
                        compact
                        hidePatterns={hidePatterns}
                        data={entity}
                        collapsible={false}
                        disabled={isDisabled}
                        buttonConfig={{
                          className: cn(
                            'font-bold cursor-pointer',
                            isSelected
                              ? 'bg-su-green text-su-white hover:bg-su-green'
                              : 'bg-su-orange text-su-white hover:bg-su-black',
                            isDisabled && 'opacity-50 cursor-not-allowed hover:bg-su-orange'
                          ),
                          disabled: isDisabled,
                          onClick: () => handleSelect(entityId, schemaName),
                          children: isSelected ? `Selected: ${entityName}` : buttonText,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
