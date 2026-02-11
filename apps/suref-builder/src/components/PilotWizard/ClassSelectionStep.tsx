import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Box, VStack, Button, Tabs } from '@chakra-ui/react'
import { Link as ChakraLink } from '@chakra-ui/react'
import { getCoreClasses } from 'salvageunion-reference'
import { Text, EntityDisplay } from '../../chakra'
import { getLevel1AbilitiesForClass, getAllCoreLevel1Abilities } from './utils'
import { getEntitySlug } from 'suref-react'
import type { UsePilotWizardStateReturn } from './usePilotWizardState'

interface ClassSelectionStepProps {
  wizardState: UsePilotWizardStateReturn
  onComplete: () => void
}

export function ClassSelectionStep({ wizardState, onComplete }: ClassSelectionStepProps) {
  const { state, updateField } = wizardState
  // Use a ref to track the latest selected ability ID to avoid stale closures
  const selectedAbilityIdRef = useRef<string | null>(state.selectedAbilityId)

  useEffect(() => {
    selectedAbilityIdRef.current = state.selectedAbilityId
  }, [state.selectedAbilityId])

  const coreClasses = useMemo(() => {
    const classes = getCoreClasses()
    return classes.sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  const [selectedTab, setSelectedTab] = useState<string>(() => {
    if (state.selectedClassId) return state.selectedClassId
    // Pre-select first class
    const classes = getCoreClasses().sort((a, b) => a.name.localeCompare(b.name))
    return classes.length > 0 && classes[0] ? classes[0].id : ''
  })

  const selectedClass = useMemo(() => {
    return coreClasses.find((c) => c.id === selectedTab) || null
  }, [coreClasses, selectedTab])

  const isSalvager = selectedClass?.id === 'salvager'

  const availableAbilities = useMemo(() => {
    if (!selectedClass) return []
    let abilities = []
    if (isSalvager) {
      abilities = getAllCoreLevel1Abilities()
    } else {
      abilities = getLevel1AbilitiesForClass(selectedClass)
    }
    // If an ability is selected, only show that one
    if (state.selectedAbilityId) {
      return abilities.filter((ability) => ability.id === state.selectedAbilityId)
    }
    return abilities
  }, [selectedClass, isSalvager, state.selectedAbilityId])

  const handleClassSelect = useCallback(() => {
    if (!selectedClass) return
    // Use the ref to get the latest ability ID value to avoid stale closures
    if (selectedAbilityIdRef.current) {
      updateField('selectedClassId', selectedClass.id)
      onComplete()
    }
  }, [selectedClass, updateField, onComplete])

  const handleAbilitySelect = useCallback(
    (abilityId: string) => {
      if (state.selectedAbilityId === abilityId) {
        updateField('selectedAbilityId', null)
      } else {
        updateField('selectedAbilityId', abilityId)
      }
    },
    [state.selectedAbilityId, updateField]
  )

  const handleTabChange = useCallback(
    (classId: string) => {
      setSelectedTab(classId)
      updateField('selectedAbilityId', null)
    },
    [updateField]
  )

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Choose your Pilot Class and your first Ability
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          There are six core Pilot classes; Engineer, Hacker, Hauler, Salvager, Scout, and Soldier.
          Each is differentiated by the different Ability trees they can pick from. Abilities are
          the unique actions a pilot can make in the game. Your Pilot starts with 1 Ability of your
          choice. The Salvager is an exception. As a 'jack of all trades' Class, they can pick from
          any of the Core Ability trees. However, they can never advance beyond them. Your Pilot
          starts with 10 Hit Points, 5 AP, and 6 Inventory Slots.
        </Text>
      </VStack>

      <Tabs.Root value={selectedTab} onValueChange={(e) => handleTabChange(e.value)}>
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
            {coreClasses.map((cls) => (
              <Tabs.Trigger
                key={cls.id}
                value={cls.id}
                fontSize="lg"
                fontWeight="bold"
                color="fg.default"
                _selected={{
                  bg: 'su.orange',
                  color: 'su.white',
                  borderBottomColor: 'su.orange',
                }}
              >
                {cls.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {selectedClass && (
            <VStack gap={4} align="stretch">
              {/* Class Display with image (40% width) and abilities as children */}
              <EntityDisplay
                data={selectedClass}
                compact
                hideActions
                hideChoices
                hidePatterns
                imageWidth="40%"
                rightContent={
                  <Button
                    asChild
                    size="sm"
                    bg="su.orange"
                    color="su.white"
                    borderWidth="2px"
                    borderColor="su.black"
                    borderRadius="md"
                    fontSize="xs"
                    fontWeight="bold"
                    px={3}
                    py={1}
                    _hover={{ bg: 'su.black' }}
                  >
                    <ChakraLink
                      href={`/schema/classes/item/${getEntitySlug(selectedClass)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      See Full Class
                    </ChakraLink>
                  </Button>
                }
              >
                {/* Abilities Display - rendered as children within the EntityDisplay container */}
                {availableAbilities.length > 0 ? (
                  <VStack gap={4} align="stretch">
                    <Box mb={2}>
                      <Box color="su.black" fontWeight="medium" lineHeight="relaxed" fontSize="xs">
                        Your Pilot starts with 10 Hit Points, 5 AP, and 6 Inventory Slots.
                      </Box>
                      <Box
                        color="su.black"
                        fontWeight="medium"
                        lineHeight="relaxed"
                        fontSize="xs"
                        mt={1}
                      >
                        Your Pilot starts with 1 Ability of your choice.
                      </Box>
                    </Box>
                    <Text variant="pseudoheader" fontSize="lg" textTransform="uppercase">
                      Level 1 Abilities
                    </Text>
                    {availableAbilities.map((ability) => {
                      const isSelected = state.selectedAbilityId === ability.id
                      return (
                        <EntityDisplay
                          key={ability.id}
                          data={ability}
                          compact
                          hideActions
                          hideChoices
                          showFooter
                          collapsible
                          defaultExpanded={false}
                          expanded={isSelected ? true : undefined}
                          headerColor={isSelected ? 'su.brick' : undefined}
                          onClick={() => handleAbilitySelect(ability.id)}
                          buttonConfig={{
                            bg: 'su.brick',
                            color: 'su.white',
                            fontWeight: 'bold',
                            children: isSelected ? 'Selected' : `Select ${ability.name}`,
                            onClick: (e) => {
                              e.stopPropagation()
                              handleAbilitySelect(ability.id)
                            },
                          }}
                        />
                      )
                    })}
                  </VStack>
                ) : (
                  <Box p={4} textAlign="center">
                    <Text color="fg.muted">No abilities available for this class.</Text>
                  </Box>
                )}
              </EntityDisplay>
            </VStack>
          )}
        </Box>
      </Tabs.Root>

      {selectedClass && (
        <Button
          w="full"
          bg={state.selectedAbilityId ? 'su.orange' : 'gray.400'}
          color="su.white"
          borderWidth="3px"
          borderColor="su.black"
          borderRadius="md"
          fontSize="lg"
          fontWeight="bold"
          py={6}
          _hover={state.selectedAbilityId ? { bg: 'su.black' } : {}}
          disabled={!state.selectedAbilityId}
          onClick={handleClassSelect}
        >
          SELECT {selectedClass.name.toUpperCase()}
        </Button>
      )}
    </VStack>
  )
}
