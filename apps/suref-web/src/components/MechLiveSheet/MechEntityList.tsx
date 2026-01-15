import { useState, useMemo, useCallback } from 'react'
import { Flex, VStack, Box } from '@chakra-ui/react'
import { getTechLevelNumber, type SURefSystem, type SURefModule } from 'salvageunion-reference'
import { EntityDisplay } from '../entity/EntityDisplay'
import { StatDisplay } from '../StatDisplay'
import { AddStatButton } from '../shared/AddStatButton'
import { Card } from '../shared/Card'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'
import { Text } from '../base/Text'
import type { HydratedEntity } from '../../types/hydrated'
import { useUpdateEntity } from '../../hooks/suentity'
import { getTiltRotation } from '../../utils/tiltUtils'

interface MechEntityListProps {
  /** Title for the box (e.g., "Systems" or "Modules") */
  title: string
  /** Schema name for the entity type */
  schemaName: 'systems' | 'modules'
  /** Array of hydrated entities */
  entities: HydratedEntity[]
  /** Number of used slots */
  usedSlots: number
  /** Total available slots */
  totalSlots: number
  /** Callback when an entity is removed */
  onRemove?: (id: string) => void
  /** Callback when an entity is added */
  onAdd?: (id: string) => void
  /** Whether the component is disabled */
  disabled?: boolean
  /** Hides add/remove buttons and damage UI when viewing another player's sheet */
  readOnly?: boolean
}

interface EntityItemProps {
  entity: HydratedEntity
  ref: SURefSystem | SURefModule
  schemaName: 'systems' | 'modules'
  disabled: boolean
  readOnly: boolean
  onRemove?: (id: string) => void
  onToggleDamaged: (entity: HydratedEntity) => void
}

function EntityItem({
  entity,
  ref,
  schemaName,
  disabled,
  readOnly,
  onRemove,
  onToggleDamaged,
}: EntityItemProps) {
  const metadata = useMemo(() => {
    return (
      entity.metadata || {
        damaged: false,
      }
    )
  }, [entity.metadata])

  const isDamaged = (metadata as { damaged?: boolean }).damaged ?? false
  const actionRotation = useMemo(() => getTiltRotation(), [])

  return (
    <Box w="full" position="relative">
      <Box
        opacity={isDamaged ? 0.5 : 1}
        transition="opacity 0.3s ease"
        transform={isDamaged ? `rotate(${actionRotation}deg)` : undefined}
        transitionProperty={isDamaged ? 'opacity, transform' : 'opacity'}
        transitionDuration="0.3s"
      >
        <EntityDisplay
          data={ref}
          compact
          disabled={disabled}
          damaged={isDamaged}
          rightContent={
            !readOnly ? (
              <Box w="40px" h="40px" display="flex" alignItems="center" justifyContent="center">
                <StatDisplay
                  label={isDamaged ? 'RPR' : 'DMG'}
                  value={isDamaged ? '+' : '-'}
                  onClick={() => onToggleDamaged(entity)}
                  bg={isDamaged ? 'su.orange' : 'brand.srd'}
                  valueColor="su.white"
                  disabled={disabled}
                  compact
                />
              </Box>
            ) : undefined
          }
          buttonConfig={
            onRemove
              ? {
                  bg: 'brand.srd',
                  color: 'su.white',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  _hover: { bg: 'su.black' },
                  onClick: (e) => {
                    e.stopPropagation()
                    const confirmed = window.confirm(
                      `Are you sure you want to remove "${ref.name}"?`
                    )
                    if (confirmed) {
                      onRemove(entity.id)
                    }
                  },
                  children: `Remove ${schemaName === 'systems' ? 'System' : 'Module'}`,
                }
              : undefined
          }
        />
      </Box>
      {isDamaged && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={1}
          px={2}
          filter="drop-shadow(0 0 4px rgba(0, 0, 0, 0.8))"
          w="auto"
        >
          <Box textAlign="center" w="auto">
            <Text fontSize="sm" textTransform="uppercase" fontWeight="bold" color="su.black">
              Damaged
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export function MechEntityList({
  title,
  schemaName,
  entities,
  usedSlots,
  totalSlots,
  onRemove,
  onAdd,
  disabled = false,
  readOnly = false,
}: MechEntityListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const updateEntity = useUpdateEntity()

  const sortedEntities = useMemo(() => {
    return entities
      .map((entity) => ({
        entity,
        ref: entity.ref as SURefSystem | SURefModule,
      }))
      .filter((e) => e.ref !== undefined)
      .sort((a, b) => {
        const aTechLevel = getTechLevelNumber(a.ref) ?? 0
        const bTechLevel = getTechLevelNumber(b.ref) ?? 0
        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }
        return a.ref.name.localeCompare(b.ref.name)
      })
  }, [entities])

  const canAddMore = usedSlots < totalSlots

  const handleSelect = (entityId: string) => {
    onAdd?.(entityId)
    setIsModalOpen(false)
  }

  const label = schemaName === 'systems' ? 'Sys' : 'Mod'

  const handleToggleDamaged = useCallback(
    (entity: HydratedEntity) => {
      const currentMetadata = (entity.metadata as { damaged?: boolean } | null) || {
        damaged: false,
      }
      const isDamaged = currentMetadata.damaged ?? false
      updateEntity.mutate({
        id: entity.id,
        updates: {
          metadata: {
            ...currentMetadata,
            damaged: !isDamaged,
          },
        },
      })
    },
    [updateEntity]
  )

  return (
    <>
      <Card
        bg="bg.builder.mech"
        title={title}
        disabled={disabled}
        rightContent={
          <Flex gap={3}>
            {onAdd && (
              <AddStatButton
                onClick={() => setIsModalOpen(true)}
                disabled={disabled || !canAddMore}
                bottomLabel={title}
              />
            )}
            <StatDisplay
              label={label}
              bottomLabel="Slots"
              value={usedSlots}
              outOfMax={totalSlots}
              disabled={disabled}
              hoverText={
                schemaName === 'systems'
                  ? 'Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors.'
                  : "Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
              }
            />
          </Flex>
        }
      >
        <VStack gap={4} w="full">
          {sortedEntities.map(({ entity, ref }) => (
            <EntityItem
              key={entity.id}
              entity={entity}
              ref={ref}
              schemaName={schemaName}
              disabled={disabled}
              readOnly={readOnly}
              onRemove={onRemove}
              onToggleDamaged={handleToggleDamaged}
            />
          ))}
        </VStack>
      </Card>

      <EntitySelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schemaNames={[schemaName]}
        onSelect={(entityId) => handleSelect(entityId)}
        title={`Add ${title}`}
        selectButtonTextPrefix="Add"
      />
    </>
  )
}
