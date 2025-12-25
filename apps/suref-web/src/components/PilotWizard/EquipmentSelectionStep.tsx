import { useMemo, useCallback } from 'react'
import { VStack, Button } from '@chakra-ui/react'
import { getIndexable } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { EntityDisplay } from '../entity/EntityDisplay'
import { getTL1Equipment } from './utils'
import type { UsePilotWizardStateReturn } from './usePilotWizardState'

interface EquipmentSelectionStepProps {
  wizardState: UsePilotWizardStateReturn
  onComplete: () => void
}

export function EquipmentSelectionStep({ wizardState, onComplete }: EquipmentSelectionStepProps) {
  const { state, updateField } = wizardState

  const availableEquipment = useMemo(() => {
    const allEquipment = getTL1Equipment()
    // Filter out equipment where indexable: false
    const indexableEquipment = allEquipment.filter((equip) => {
      const indexable = getIndexable(equip)
      return indexable !== false
    })

    // When 2 items are selected, only show those 2 (like abilities page behavior)
    if (state.selectedEquipmentIds.length === 2) {
      return indexableEquipment.filter((equip) => state.selectedEquipmentIds.includes(equip.id))
    }

    // When 0 or 1 selected, show all equipment
    return indexableEquipment
  }, [state.selectedEquipmentIds])

  const handleEquipmentToggle = useCallback(
    (equipmentId: string) => {
      const currentIds = state.selectedEquipmentIds
      if (currentIds.includes(equipmentId)) {
        updateField('selectedEquipmentIds', currentIds.filter((id) => id !== equipmentId))
      } else if (currentIds.length < 2) {
        updateField('selectedEquipmentIds', [...currentIds, equipmentId])
      }
    },
    [state.selectedEquipmentIds, updateField]
  )

  const handleNext = useCallback(() => {
    if (state.selectedEquipmentIds.length === 2) {
      onComplete()
    }
  }, [state.selectedEquipmentIds.length, onComplete])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Choose Your Equipment
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          You may choose two pieces of Tech 1 Pilot Equipment from the list.
        </Text>
        <Text textAlign="center" fontSize="sm" color="fg.muted" fontStyle="italic">
          Selected: {state.selectedEquipmentIds.length} / 2
        </Text>
      </VStack>

      <VStack gap={5} align="stretch">
        {availableEquipment.map((equipment) => {
          const isSelected = state.selectedEquipmentIds.includes(equipment.id)
          return (
            <EntityDisplay
              key={equipment.id}
              data={equipment}
              compact
              hideActions
              hideChoices
              showFooter
              collapsible
              defaultExpanded={false}
              expanded={isSelected ? true : undefined}
              headerColor={isSelected ? 'su.brick' : undefined}
              onClick={() => handleEquipmentToggle(equipment.id)}
              buttonConfig={{
                bg: 'su.brick',
                color: 'su.white',
                fontWeight: 'bold',
                children: isSelected ? 'Selected' : `Select ${equipment.name}`,
                onClick: (e) => {
                  e.stopPropagation()
                  handleEquipmentToggle(equipment.id)
                },
              }}
            />
          )
        })}
      </VStack>

      <Button
        w="full"
        bg={state.selectedEquipmentIds.length === 2 ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={state.selectedEquipmentIds.length === 2 ? { bg: 'su.black' } : {}}
        disabled={state.selectedEquipmentIds.length !== 2}
        onClick={handleNext}
      >
        NEXT
      </Button>
    </VStack>
  )
}
