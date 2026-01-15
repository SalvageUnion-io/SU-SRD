import { useMemo, useState, useCallback } from 'react'
import { Box, VStack, Button, Tabs, Flex } from '@chakra-ui/react'
import { SalvageUnionReference, getTechLevel } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { EntityDisplay } from '../entity/EntityDisplay'
import type { UseMechWizardStateReturn } from './useMechWizardState'
import { getWorkshopManualChassis, getChassisByTechLevel } from './utils'

interface ChassisSelectionStepProps {
  wizardState: UseMechWizardStateReturn
  onComplete: () => void
}

export function ChassisSelectionStep({ wizardState, onComplete }: ChassisSelectionStepProps) {
  const { state, setSelectedChassisId } = wizardState
  const [selectedTechLevel, setSelectedTechLevel] = useState<number | 'B' | 'N' | null>(() => {
    // If a chassis is already selected, use its tech level
    if (state.selectedChassisId) {
      const chassis = SalvageUnionReference.Chassis.find((c) => c.id === state.selectedChassisId)
      if (chassis) {
        return getTechLevel(chassis) ?? 1
      }
    }
    return 1
  })
  const [selectedChassisTab, setSelectedChassisTab] = useState<string>(
    state.selectedChassisId || ''
  )

  const workshopChassis = useMemo(() => getWorkshopManualChassis(), [])

  const techLevels = useMemo(() => {
    const levels = new Set<number | 'B' | 'N'>()
    workshopChassis.forEach((chassis) => {
      const tl = getTechLevel(chassis)
      if (tl !== undefined) {
        levels.add(tl)
      }
    })
    // Sort: numbers first (ascending), then 'B', then 'N'
    return Array.from(levels).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b
      if (typeof a === 'number') return -1
      if (typeof b === 'number') return 1
      if (a === 'B' && b === 'N') return -1
      if (a === 'N' && b === 'B') return 1
      return 0
    })
  }, [workshopChassis])

  const filteredChassis = useMemo(() => {
    if (selectedTechLevel === null) return workshopChassis
    return getChassisByTechLevel(workshopChassis, selectedTechLevel)
  }, [workshopChassis, selectedTechLevel])

  const selectedChassis = useMemo(() => {
    return filteredChassis.find((c) => c.id === selectedChassisTab) || null
  }, [filteredChassis, selectedChassisTab])

  const isChassisSelected = useMemo(() => {
    return selectedChassis?.id === state.selectedChassisId
  }, [selectedChassis?.id, state.selectedChassisId])

  const handleChassisSelect = useCallback(() => {
    if (selectedChassis) {
      setSelectedChassisId(selectedChassis.id)
    }
  }, [selectedChassis, setSelectedChassisId])

  const handleNext = useCallback(() => {
    if (state.selectedChassisId) {
      onComplete()
    }
  }, [state.selectedChassisId, onComplete])

  const handleTechLevelChange = useCallback(
    (techLevel: number | 'B' | 'N' | null) => {
      setSelectedTechLevel(techLevel)
      setSelectedChassisTab('')
      setSelectedChassisId(null)
    },
    [setSelectedChassisId]
  )

  const handleChassisTabChange = useCallback((chassisId: string) => {
    setSelectedChassisTab(chassisId)
  }, [])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Choose your Mech Chassis
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          Select a chassis from the Workshop Manual. Each chassis has different stats, slot
          capacities, and available patterns.
        </Text>
      </VStack>

      {/* Tech Level Tabs */}
      <Flex gap={1} flexWrap="wrap" justifyContent="center">
        {techLevels.map((tl) => {
          const displayLabel = typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'N'
          return (
            <Button
              key={String(tl)}
              onClick={() => handleTechLevelChange(tl === selectedTechLevel ? null : tl)}
              px={3}
              py={2}
              borderRadius="md"
              fontWeight="bold"
              fontSize="sm"
              bg={selectedTechLevel === tl ? 'su.orange' : 'su.lightBlue'}
              color={selectedTechLevel === tl ? 'su.white' : 'su.black'}
            >
              {displayLabel}
            </Button>
          )
        })}
        <Button
          onClick={() => handleTechLevelChange(null)}
          px={3}
          py={2}
          borderRadius="md"
          fontWeight="bold"
          fontSize="sm"
          bg={selectedTechLevel === null ? 'su.orange' : 'su.lightBlue'}
          color={selectedTechLevel === null ? 'su.white' : 'su.black'}
        >
          All
        </Button>
      </Flex>

      {/* Chassis Tabs */}
      {filteredChassis.length > 0 && (
        <Tabs.Root
          value={selectedChassisTab}
          onValueChange={(e) => handleChassisTabChange(e.value)}
        >
          <Box>
            <Tabs.List
              borderBottom="3px solid"
              borderColor="border.default"
              justifyContent="center"
              flexWrap="wrap"
              gap={2}
              pb={4}
              mb={4}
            >
              {filteredChassis.map((chassis) => (
                <Tabs.Trigger
                  key={chassis.id}
                  value={chassis.id}
                  fontSize="lg"
                  fontWeight="bold"
                  color="fg.default"
                  _selected={{
                    bg: 'su.orange',
                    color: 'su.white',
                    borderBottomColor: 'su.orange',
                  }}
                >
                  {chassis.name}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {selectedChassis && (
              <VStack gap={4} align="stretch">
                <EntityDisplay
                  data={selectedChassis}
                  hideActions
                  hideChoices
                  hidePatterns
                  imageWidth="40%"
                  headerColor={isChassisSelected ? 'su.brick' : undefined}
                  buttonConfig={{
                    bg: isChassisSelected ? 'su.brick' : 'su.orange',
                    color: 'su.white',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    _hover: { bg: isChassisSelected ? 'su.black' : 'su.black' },
                    onClick: handleChassisSelect,
                    children: isChassisSelected ? 'Selected' : 'Select This Chassis',
                  }}
                />
              </VStack>
            )}
          </Box>
        </Tabs.Root>
      )}

      <Button
        w="full"
        bg={state.selectedChassisId ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={state.selectedChassisId ? { bg: 'su.black' } : {}}
        disabled={!state.selectedChassisId}
        _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
        onClick={handleNext}
      >
        INSTALL SYSTEMS & MODULES
      </Button>
    </VStack>
  )
}
