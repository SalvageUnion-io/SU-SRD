import { useMemo, useState, useCallback } from 'react'
import { VStack, Button, Flex } from '@chakra-ui/react'
import {
  SalvageUnionReference,
  getSystemSlots,
  getModuleSlots,
  getSlotsRequired,
  getTechLevelNumber,
  type SURefChassis,
  type SURefSystem,
  type SURefModule,
} from 'salvageunion-reference'
import { Text } from '../base/Text'
import { Card } from '../shared/Card'
import { StatDisplay } from '../StatDisplay'
import { AddStatButton } from '../shared/AddStatButton'
import { EntityDisplay } from '../entity/EntityDisplay'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'
import type { UseMechWizardStateReturn } from './useMechWizardState'

interface SystemsModulesStepProps {
  wizardState: UseMechWizardStateReturn
  onComplete: () => void
}

export function SystemsModulesStep({ wizardState, onComplete }: SystemsModulesStepProps) {
  const {
    state,
    setSelectedSystemIds,
    setSelectedModuleIds,
    setSelectedPatternName,
    setPatternName,
  } = wizardState
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false)
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false)

  const selectedChassis = useMemo(() => {
    if (!state.selectedChassisId) return null
    return SalvageUnionReference.Chassis.find((c) => c.id === state.selectedChassisId) || null
  }, [state.selectedChassisId])

  const chassisRef = selectedChassis as SURefChassis | null
  const totalSystemSlots = chassisRef ? (getSystemSlots(chassisRef) ?? 0) : 0
  const totalModuleSlots = chassisRef ? (getModuleSlots(chassisRef) ?? 0) : 0

  const selectedSystems = useMemo(() => {
    return state.selectedSystemIds
      .map((id) => SalvageUnionReference.get('systems', id))
      .filter((s): s is SURefSystem & { schemaName: 'systems' } => s !== undefined)
  }, [state.selectedSystemIds])

  const selectedModules = useMemo(() => {
    return state.selectedModuleIds
      .map((id) => SalvageUnionReference.get('modules', id))
      .filter((m): m is SURefModule & { schemaName: 'modules' } => m !== undefined)
  }, [state.selectedModuleIds])

  const usedSystemSlots = useMemo(() => {
    return selectedSystems.reduce((sum, system) => {
      const slotsRequired = getSlotsRequired(system) ?? 0
      return sum + slotsRequired
    }, 0)
  }, [selectedSystems])

  const usedModuleSlots = useMemo(() => {
    return selectedModules.reduce((sum, module) => {
      const slotsRequired = getSlotsRequired(module) ?? 0
      return sum + slotsRequired
    }, 0)
  }, [selectedModules])

  const canAddMoreSystems = usedSystemSlots < totalSystemSlots
  const canAddMoreModules = usedModuleSlots < totalModuleSlots

  const sortedSystems = useMemo(() => {
    return [...selectedSystems].sort((a, b) => {
      const aTechLevel = getTechLevelNumber(a) ?? 0
      const bTechLevel = getTechLevelNumber(b) ?? 0
      if (aTechLevel !== bTechLevel) {
        return aTechLevel - bTechLevel
      }
      return a.name.localeCompare(b.name)
    })
  }, [selectedSystems])

  const sortedModules = useMemo(() => {
    return [...selectedModules].sort((a, b) => {
      const aTechLevel = getTechLevelNumber(a) ?? 0
      const bTechLevel = getTechLevelNumber(b) ?? 0
      if (aTechLevel !== bTechLevel) {
        return aTechLevel - bTechLevel
      }
      return a.name.localeCompare(b.name)
    })
  }, [selectedModules])

  const handleAddSystem = useCallback(
    (systemId: string) => {
      if (!state.selectedSystemIds.includes(systemId)) {
        setSelectedSystemIds([...state.selectedSystemIds, systemId])
      }
      setIsSystemModalOpen(false)
    },
    [state.selectedSystemIds, setSelectedSystemIds]
  )

  const handleRemoveSystem = useCallback(
    (systemId: string) => {
      setSelectedSystemIds(state.selectedSystemIds.filter((id) => id !== systemId))
    },
    [state.selectedSystemIds, setSelectedSystemIds]
  )

  const handleAddModule = useCallback(
    (moduleId: string) => {
      if (!state.selectedModuleIds.includes(moduleId)) {
        setSelectedModuleIds([...state.selectedModuleIds, moduleId])
      }
      setIsModuleModalOpen(false)
    },
    [state.selectedModuleIds, setSelectedModuleIds]
  )

  const handleRemoveModule = useCallback(
    (moduleId: string) => {
      setSelectedModuleIds(state.selectedModuleIds.filter((id) => id !== moduleId))
    },
    [state.selectedModuleIds, setSelectedModuleIds]
  )

  const handleSelectPattern = useCallback(
    (patternName: string) => {
      if (!chassisRef) return

      const pattern = chassisRef.patterns?.find((p) => p.name === patternName)
      if (!pattern) return

      // Clear existing systems and modules
      setSelectedSystemIds([])
      setSelectedModuleIds([])

      // Apply pattern systems
      const systemIds: string[] = []
      pattern.systems?.forEach((systemEntry) => {
        const system = SalvageUnionReference.findIn('systems', (s) => s.name === systemEntry.name)
        if (system) {
          const count =
            'count' in systemEntry && typeof systemEntry.count === 'number' ? systemEntry.count : 1
          for (let i = 0; i < count; i++) {
            systemIds.push(system.id)
          }
        }
      })

      // Apply pattern modules
      const moduleIds: string[] = []
      pattern.modules?.forEach((moduleEntry) => {
        const module = SalvageUnionReference.findIn('modules', (m) => m.name === moduleEntry.name)
        if (module) {
          const count =
            'count' in moduleEntry && typeof moduleEntry.count === 'number' ? moduleEntry.count : 1
          for (let i = 0; i < count; i++) {
            moduleIds.push(module.id)
          }
        }
      })

      setSelectedSystemIds(systemIds)
      setSelectedModuleIds(moduleIds)
      setSelectedPatternName(patternName)
      setPatternName(patternName)
    },
    [chassisRef, setSelectedSystemIds, setSelectedModuleIds, setSelectedPatternName, setPatternName]
  )

  const handleClearAll = useCallback(() => {
    setSelectedSystemIds([])
    setSelectedModuleIds([])
    setSelectedPatternName(null)
    setPatternName('')
  }, [setSelectedSystemIds, setSelectedModuleIds, setSelectedPatternName, setPatternName])

  if (!selectedChassis) {
    return (
      <VStack gap={4} align="stretch">
        <Text textAlign="center" color="fg.muted">
          Please select a chassis first.
        </Text>
      </VStack>
    )
  }

  const patterns = chassisRef?.patterns || []

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={2} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Install Systems & Modules
        </Text>
        <Text textAlign="center" fontSize="md" color="fg.muted">
          Add systems and modules to your mech, or select a pattern to automatically configure them.
        </Text>
      </VStack>

      {/* Pattern Selection */}
      {patterns.length > 0 && (
        <VStack gap={4} align="stretch">
          <Flex gap={2} flexWrap="wrap" justifyContent="center">
            {patterns.map((pattern) => {
              const isLegalStarting = 'legalStarting' in pattern && pattern.legalStarting
              return (
                <Button
                  key={pattern.name}
                  onClick={() => handleSelectPattern(pattern.name)}
                  bg={state.selectedPatternName === pattern.name ? 'su.orange' : 'su.lightBlue'}
                  color={state.selectedPatternName === pattern.name ? 'su.white' : 'su.black'}
                  fontWeight="bold"
                  px={4}
                  py={2}
                  borderRadius="md"
                  _hover={{
                    bg: state.selectedPatternName === pattern.name ? 'su.black' : 'su.orange',
                  }}
                >
                  {pattern.name}
                  {isLegalStarting && (
                    <Text as="span" ml={2} fontSize="lg">
                      ★
                    </Text>
                  )}
                </Button>
              )
            })}
          </Flex>
          <Text
            variant="pseudoheader"
            textAlign="center"
            fontSize="lg"
            textTransform="uppercase"
            w="full"
          >
            OR
          </Text>
        </VStack>
      )}

      {/* Systems List */}
      <Card
        bg="bg.builder.mech"
        title="Systems"
        rightContent={
          <Flex gap={3}>
            <StatDisplay
              label="Clear"
              value="×"
              bottomLabel="All"
              onClick={handleClearAll}
              disabled={
                state.selectedSystemIds.length === 0 && state.selectedModuleIds.length === 0
              }
              bg="gray.400"
              valueColor="su.white"
              ariaLabel="Clear all systems and modules"
            />
            <AddStatButton
              onClick={() => setIsSystemModalOpen(true)}
              disabled={!canAddMoreSystems}
              bottomLabel="System"
            />
            <StatDisplay
              label="Sys"
              bottomLabel="Slots"
              value={usedSystemSlots}
              outOfMax={totalSystemSlots}
              disabled={!canAddMoreSystems}
              hoverText="Each System has a System Slot value which represents how much space it takes up on a Mech, conversely a Mechs System Slot value represents how many Systems it can mount. This is an abstract value that covers not only size, but energy requirements, ammo storage and a host of other factors."
            />
          </Flex>
        }
      >
        <VStack gap={4} w="full">
          {sortedSystems.length > 0 ? (
            sortedSystems.map((system) => (
              <EntityDisplay
                key={system.id}
                data={system}
                compact
                buttonConfig={{
                  bg: 'brand.srd',
                  color: 'su.white',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  _hover: { bg: 'su.black' },
                  onClick: () => handleRemoveSystem(system.id),
                  children: 'Remove System',
                }}
              />
            ))
          ) : (
            <Text textAlign="center" color="fg.muted" py={4}>
              No systems installed
            </Text>
          )}
        </VStack>
      </Card>

      {/* Modules List */}
      <Card
        bg="bg.builder.mech"
        title="Modules"
        rightContent={
          <Flex gap={3}>
            <StatDisplay
              label="Clear"
              value="×"
              bottomLabel="All"
              onClick={handleClearAll}
              disabled={
                state.selectedSystemIds.length === 0 && state.selectedModuleIds.length === 0
              }
              bg="gray.400"
              valueColor="su.white"
              ariaLabel="Clear all systems and modules"
            />
            <AddStatButton
              onClick={() => setIsModuleModalOpen(true)}
              disabled={!canAddMoreModules}
              bottomLabel="Module"
            />
            <StatDisplay
              label="Mod"
              bottomLabel="Slots"
              value={usedModuleSlots}
              outOfMax={totalModuleSlots}
              disabled={!canAddMoreModules}
              hoverText="Each Module has a Module Slot value which represents how much space it takes up on a Mech, conversely a Mech's Module Slot value represents how many Modules it can mount."
            />
          </Flex>
        }
      >
        <VStack gap={4} w="full">
          {sortedModules.length > 0 ? (
            sortedModules.map((module) => (
              <EntityDisplay
                key={module.id}
                data={module}
                compact
                buttonConfig={{
                  bg: 'brand.srd',
                  color: 'su.white',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  _hover: { bg: 'su.black' },
                  onClick: () => handleRemoveModule(module.id),
                  children: 'Remove Module',
                }}
              />
            ))
          ) : (
            <Text textAlign="center" color="fg.muted" py={4}>
              No modules installed
            </Text>
          )}
        </VStack>
      </Card>

      {/* Progress Button */}
      <Button
        w="full"
        bg="su.orange"
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={{ bg: 'su.black' }}
        onClick={onComplete}
      >
        CONTINUE TO DETAILS
      </Button>

      {/* Modals */}
      <EntitySelectionModal
        isOpen={isSystemModalOpen}
        onClose={() => setIsSystemModalOpen(false)}
        schemaNames={['systems']}
        onSelect={handleAddSystem}
        title="Add System"
        selectButtonTextPrefix="Add"
      />

      <EntitySelectionModal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        schemaNames={['modules']}
        onSelect={handleAddModule}
        title="Add Module"
        selectButtonTextPrefix="Add"
      />
    </VStack>
  )
}
