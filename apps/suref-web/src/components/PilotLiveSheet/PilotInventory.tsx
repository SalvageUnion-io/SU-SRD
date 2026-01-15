import { useMemo, useState } from 'react'
import { Flex, Grid, VStack } from '@chakra-ui/react'
import {
  SalvageUnionReference,
  type SURefEquipment,
  type SURefSystem,
  type SURefModule,
  getSystemSlots,
  getModuleSlots,
  getSlotsRequired,
  getTechLevelNumber,
} from 'salvageunion-reference'
import { StatDisplay } from '../StatDisplay'
import { AddStatButton } from '../shared/AddStatButton'
import { Card } from '../shared/Card'
import { EntityDisplay } from '../entity/EntityDisplay'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'
import { EquipmentSelector } from './EquipmentSelector'
import { useManagePilotInventory } from '../../hooks/pilot/useManagePilotInventory'
import { useHydratedPilot } from '../../hooks/pilot'
import { useManagePilotEquipmentSystemsAndModules } from '../../hooks/pilot/useManagePilotEquipmentSystemsAndModules'
import type { HydratedEntity } from '../../types/hydrated'

interface PilotInventoryProps {
  id: string
  /** Greys out the Card background (only for missing required data) */
  disabled?: boolean
  /** Hides add/remove buttons when viewing another player's sheet */
  readOnly?: boolean
}

interface EquipmentItemWithSlotsProps {
  item: {
    id: string
    equipment: SURefEquipment & { schemaName: string }
    index: number
    entity: HydratedEntity
  }
  pilotId: string
  disabled: boolean
  readOnly: boolean
  onRemoveEquipment: (id: string) => void
}

function EquipmentItemWithSlots({
  item,
  pilotId,
  disabled,
  readOnly,
  onRemoveEquipment,
}: EquipmentItemWithSlotsProps) {
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false)
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false)

  const {
    handleAddSystem,
    handleRemoveSystem,
    handleAddModule,
    handleRemoveModule,
    equipmentSystems,
    equipmentModules,
  } = useManagePilotEquipmentSystemsAndModules(pilotId, item.id)

  const systemSlots = getSystemSlots(item.equipment)
  const moduleSlots = getModuleSlots(item.equipment)

  const allSystems = useMemo(() => SalvageUnionReference.findAllIn('systems', () => true), [])
  const allModules = useMemo(() => SalvageUnionReference.findAllIn('modules', () => true), [])

  const sortedSystems = useMemo(() => {
    return equipmentSystems
      .map((s) => allSystems.find((e) => e.id === s.ref.id))
      .filter((e): e is SURefSystem & { schemaName: 'systems' } => e !== undefined)
      .sort((a, b) => {
        const aTechLevel = getTechLevelNumber(a) ?? 0
        const bTechLevel = getTechLevelNumber(b) ?? 0
        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }
        return a.name.localeCompare(b.name)
      })
  }, [equipmentSystems, allSystems])

  const sortedModules = useMemo(() => {
    return equipmentModules
      .map((m) => allModules.find((e) => e.id === m.ref.id))
      .filter((e): e is SURefModule & { schemaName: 'modules' } => e !== undefined)
      .sort((a, b) => {
        const aTechLevel = getTechLevelNumber(a) ?? 0
        const bTechLevel = getTechLevelNumber(b) ?? 0
        if (aTechLevel !== bTechLevel) {
          return aTechLevel - bTechLevel
        }
        return a.name.localeCompare(b.name)
      })
  }, [equipmentModules, allModules])

  const usedSystemSlots = useMemo(
    () =>
      equipmentSystems.reduce((sum, entity) => {
        const slotsRequired = getSlotsRequired(entity.ref)
        return sum + (slotsRequired ?? 0)
      }, 0),
    [equipmentSystems]
  )

  const usedModuleSlots = useMemo(
    () =>
      equipmentModules.reduce((sum, entity) => {
        const slotsRequired = getSlotsRequired(entity.ref)
        return sum + (slotsRequired ?? 0)
      }, 0),
    [equipmentModules]
  )

  const canAddMoreSystems = systemSlots !== undefined && usedSystemSlots < systemSlots
  const canAddMoreModules = moduleSlots !== undefined && usedModuleSlots < moduleSlots

  const removeButtonConfig = {
    bg: 'brand.srd',
    color: 'su.white',
    fontWeight: 'bold',
    _hover: { bg: 'su.black' },
    onClick: () => {
      const confirmed = window.confirm(`Are you sure you want to remove "${item.equipment.name}"?`)
      if (confirmed) {
        onRemoveEquipment(item.id)
      }
    },
    children: `Remove ${item.equipment.name}`,
  }

  const systemRemoveButtonConfig = (system: SURefSystem, systemEntity: HydratedEntity) => ({
    bg: 'brand.srd',
    color: 'su.white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    _hover: { bg: 'su.black' },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      const confirmed = window.confirm(`Are you sure you want to remove "${system.name}"?`)
      if (confirmed) {
        handleRemoveSystem(systemEntity.id)
      }
    },
    children: 'Remove System',
  })

  const moduleRemoveButtonConfig = (module: SURefModule, moduleEntity: HydratedEntity) => ({
    bg: 'brand.srd',
    color: 'su.white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    _hover: { bg: 'su.black' },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      const confirmed = window.confirm(`Are you sure you want to remove "${module.name}"?`)
      if (confirmed) {
        handleRemoveModule(moduleEntity.id)
      }
    },
    children: 'Remove Module',
  })

  return (
    <>
      <EntityDisplay
        buttonConfig={!readOnly && !item.entity.parentEntity ? removeButtonConfig : undefined}
        compact
        data={item.equipment}
      >
        {systemSlots !== undefined && (
          <VStack gap={2} align="stretch" pl={2} borderLeft="2px solid" borderColor="su.orange">
            <Flex gap={2} alignItems="center">
              {!readOnly && (
                <AddStatButton
                  onClick={() => setIsSystemModalOpen(true)}
                  disabled={disabled || !canAddMoreSystems}
                  bottomLabel="System"
                />
              )}
              {!readOnly && (
                <StatDisplay
                  label="Sys"
                  bottomLabel="Slots"
                  value={usedSystemSlots}
                  outOfMax={systemSlots}
                  disabled={disabled}
                  hoverText="Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors."
                />
              )}
            </Flex>
            {sortedSystems.length > 0 && (
              <VStack gap={3} align="stretch">
                {sortedSystems.map((system) => {
                  const systemEntity = equipmentSystems.find((e) => e.ref.id === system.id)
                  if (!systemEntity) return null
                  return (
                    <EntityDisplay
                      key={system.id}
                      data={system}
                      compact
                      disabled={disabled}
                      collapsible
                      defaultExpanded={false}
                      buttonConfig={
                        !readOnly ? systemRemoveButtonConfig(system, systemEntity) : undefined
                      }
                    />
                  )
                })}
              </VStack>
            )}
          </VStack>
        )}

        {moduleSlots !== undefined && (
          <VStack gap={2} align="stretch" pl={2} borderLeft="2px solid" borderColor="su.orange">
            <Flex gap={2} alignItems="center">
              {!readOnly && (
                <AddStatButton
                  onClick={() => setIsModuleModalOpen(true)}
                  disabled={disabled || !canAddMoreModules}
                  bottomLabel="Module"
                />
              )}
              {!readOnly && (
                <StatDisplay
                  label="Mod"
                  bottomLabel="Slots"
                  value={usedModuleSlots}
                  outOfMax={moduleSlots}
                  disabled={disabled}
                  hoverText="Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
                />
              )}
            </Flex>
            {sortedModules.length > 0 && (
              <VStack gap={3} align="stretch">
                {sortedModules.map((module) => {
                  const moduleEntity = equipmentModules.find((e) => e.ref.id === module.id)
                  if (!moduleEntity) return null
                  return (
                    <EntityDisplay
                      key={module.id}
                      data={module}
                      compact
                      disabled={disabled}
                      collapsible
                      defaultExpanded={false}
                      buttonConfig={
                        !readOnly ? moduleRemoveButtonConfig(module, moduleEntity) : undefined
                      }
                    />
                  )
                })}
              </VStack>
            )}
          </VStack>
        )}
      </EntityDisplay>

      {systemSlots !== undefined && (
        <EntitySelectionModal
          isOpen={isSystemModalOpen}
          onClose={() => setIsSystemModalOpen(false)}
          schemaNames={['systems']}
          onSelect={(entityId) => {
            handleAddSystem(entityId)
            setIsSystemModalOpen(false)
          }}
          title="Add System"
          selectButtonTextPrefix="Add"
        />
      )}

      {moduleSlots !== undefined && (
        <EntitySelectionModal
          isOpen={isModuleModalOpen}
          onClose={() => setIsModuleModalOpen(false)}
          schemaNames={['modules']}
          onSelect={(entityId) => {
            handleAddModule(entityId)
            setIsModuleModalOpen(false)
          }}
          title="Add Module"
          selectButtonTextPrefix="Add"
        />
      )}
    </>
  )
}

export function PilotInventory({ id, disabled = false, readOnly = false }: PilotInventoryProps) {
  const isReadOnly = readOnly
  const MAX_SLOTS = 6
  const { equipment } = useHydratedPilot(id)
  const [isEquipmentSelectorOpen, setIsEquipmentSelectorOpen] = useState(false)
  const isFull = equipment.length >= MAX_SLOTS
  const { handleAddEquipment, handleRemoveEquipment } = useManagePilotInventory(id)

  const allEquipment = useMemo(() => SalvageUnionReference.Equipment.all(), [])

  const equipmentItems = useMemo(() => {
    return equipment
      .map((equipment, index) => {
        const item = allEquipment.find((e) => e.id === equipment.ref.id)
        return item ? { id: equipment.id, equipment: item, index, entity: equipment } : null
      })
      .filter(
        (
          item
        ): item is {
          id: string
          equipment: SURefEquipment & { schemaName: string }
          index: number
          entity: HydratedEntity
        } => item !== null
      )
  }, [equipment, allEquipment])

  return (
    <>
      <Card
        bg="su.orange"
        title="Inventory"
        disabled={disabled}
        rightContent={
          <Flex alignItems="center" gap={4}>
            {!isReadOnly && (
              <AddStatButton
                onClick={() => setIsEquipmentSelectorOpen(true)}
                disabled={disabled || isFull}
                bottomLabel="Equipment"
              />
            )}
            <StatDisplay
              label="Equipment"
              value={equipment.length}
              outOfMax={MAX_SLOTS}
              disabled={disabled}
              hoverText="This is the amount of Pilot Equipment, as well as other miscellaneous things found in the wastes, a Pilot can carry. This includes weapons such as the Pistol or Rifle as well as utility items such as a Portable Comms Unit, a First Aid Kit, and more. Each Pilot starts with 6 Inventory Slots."
            />
          </Flex>
        }
      >
        <Grid templateColumns="repeat(2, 1fr)" gap={3} w="full">
          {equipmentItems.map((item) => (
            <EquipmentItemWithSlots
              key={`${item.id}-${item.index}`}
              item={item}
              pilotId={id}
              disabled={disabled}
              readOnly={isReadOnly}
              onRemoveEquipment={handleRemoveEquipment}
            />
          ))}
        </Grid>
      </Card>
      <EquipmentSelector
        isOpen={isEquipmentSelectorOpen}
        onClose={() => setIsEquipmentSelectorOpen(false)}
        onSelectEquipment={handleAddEquipment}
      />
    </>
  )
}
