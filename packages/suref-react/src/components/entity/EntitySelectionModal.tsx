import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Box, Flex, Input, Text, VStack, Spinner } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import {
  SalvageUnionReference,
  getTechLevel,
  getTechLevelNumber,
  type SURefEntity,
  type SURefEnumSchemaName,
} from 'salvageunion-reference'
import { useVirtualizer } from '@tanstack/react-virtual'
import Modal from '../Modal'
import { EntityDisplay } from './EntityDisplay'
import { TECH_LEVELS } from '../../constants/gameRules'

// Estimated height for an expanded EntityDisplay item
const ESTIMATED_ITEM_HEIGHT = 300

interface EntitySelectionModalProps {
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
    <Modal key={isOpen ? 'open' : 'closed'} isOpen={isOpen} onClose={onClose} title={title}>
      <VStack gap={0} alignItems="stretch" h="80vh" overflow="hidden">
        <VStack
          gap={4}
          alignItems="stretch"
          flexShrink={0}
          borderBottomWidth="1px"
          borderColor="su.black"
          pb={4}
          px={6}
          pt={4}
          bg="su.mediumGrey"
          w="full"
        >
          <Flex gap={2} alignItems="center" w="full">
            <Input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              w="full"
              px={4}
              py={2}
              borderWidth="2px"
              borderColor="su.black"
              borderRadius="md"
              bg="su.white"
              color="su.black"
            />
            {isFiltering && (
              <Spinner
                size="sm"
                color="su.orange"
                aria-label="Filtering results..."
                flexShrink={0}
              />
            )}
          </Flex>

          <Flex
            gap={4}
            justifyContent="space-between"
            alignItems="flex-start"
            flexWrap="wrap"
            w="full"
          >
            {showTechLevelFilter && (
              <Flex gap={1} flexWrap="wrap">
                {TECH_LEVELS.map((tl) => (
                  <Button
                    key={tl}
                    onClick={() => setTechLevelFilter(tl === techLevelFilter ? null : tl)}
                    px={3}
                    py={2}
                    borderRadius="md"
                    fontWeight="bold"
                    fontSize="sm"
                    bg={techLevelFilter === tl ? 'su.orange' : 'su.lightBlue'}
                    color={techLevelFilter === tl ? 'su.white' : 'su.black'}
                  >
                    TL{tl}
                  </Button>
                ))}
                <Button
                  onClick={() => setTechLevelFilter('B' === techLevelFilter ? null : 'B')}
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize="sm"
                  bg={techLevelFilter === 'B' ? 'su.orange' : 'su.lightBlue'}
                  color={techLevelFilter === 'B' ? 'su.white' : 'su.black'}
                >
                  Bio
                </Button>
                <Button
                  onClick={() => setTechLevelFilter('N' === techLevelFilter ? null : 'N')}
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize="sm"
                  bg={techLevelFilter === 'N' ? 'su.orange' : 'su.lightBlue'}
                  color={techLevelFilter === 'N' ? 'su.white' : 'su.black'}
                >
                  N
                </Button>
                <Button
                  onClick={() => setTechLevelFilter(null)}
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize="sm"
                  bg={techLevelFilter === null ? 'su.orange' : 'su.lightBlue'}
                  color={techLevelFilter === null ? 'su.white' : 'su.black'}
                >
                  All
                </Button>
              </Flex>
            )}

            {schemaNames.length > 1 && (
              <Flex gap={2} flexWrap="wrap" justifyContent="flex-end">
                {schemaNames.map((schema) => (
                  <Button
                    key={schema}
                    onClick={() => setSchemaFilter(schema)}
                    px={3}
                    py={2}
                    borderRadius="md"
                    fontWeight="bold"
                    fontSize="sm"
                    bg={schemaFilter === schema ? 'su.orange' : 'su.lightBlue'}
                    color={schemaFilter === schema ? 'su.white' : 'su.black'}
                    textTransform="capitalize"
                  >
                    {schema.replace(/-/g, ' ')}
                  </Button>
                ))}
                <Button
                  onClick={() => setSchemaFilter(null)}
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontWeight="bold"
                  fontSize="sm"
                  bg={schemaFilter === null ? 'su.orange' : 'su.lightBlue'}
                  color={schemaFilter === null ? 'su.white' : 'su.black'}
                >
                  All
                </Button>
              </Flex>
            )}
          </Flex>
        </VStack>

        <Box
          ref={scrollContainerRef}
          flex="1"
          minH={0}
          overflowY="auto"
          px={4}
          css={{
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'var(--chakra-colors-su-lightBlue)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--chakra-colors-su-orange)',
              borderRadius: '4px',
            },
          }}
        >
          {filteredEntities.length === 0 ? (
            <Text textAlign="center" color="su.black" py={8}>
              No items found matching your criteria.
            </Text>
          ) : (
            <Box position="relative" h={`${virtualizer.getTotalSize()}px`} w="full">
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
                  <Box
                    key={`${schemaName}-${entityId}`}
                    position="absolute"
                    top={0}
                    left={0}
                    w="full"
                    transform={`translateY(${virtualItem.start}px)`}
                    data-index={virtualItem.index}
                    ref={(node: HTMLDivElement | null) => {
                      if (node) {
                        // Register element with virtualizer for dynamic measurement
                        virtualizer.measureElement(node)
                      }
                    }}
                    pb={4}
                    px={2}
                  >
                    <EntityDisplay
                      compact
                      hidePatterns={hidePatterns}
                      data={entity}
                      collapsible={false}
                      disabled={isDisabled}
                      buttonConfig={{
                        bg: isSelected ? 'su.green' : 'su.orange',
                        color: 'su.white',
                        fontWeight: 'bold',
                        _hover: { bg: isSelected ? 'su.green' : 'su.black' },
                        _disabled: {
                          opacity: 0.5,
                          cursor: 'not-allowed',
                          _hover: { bg: 'su.orange' },
                        },
                        disabled: isDisabled,
                        onClick: () => handleSelect(entityId, schemaName),
                        children: isSelected ? `Selected: ${entityName}` : buttonText,
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </VStack>
    </Modal>
  )
}
