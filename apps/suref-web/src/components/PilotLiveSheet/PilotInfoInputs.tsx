import { useMemo } from 'react'
import { Box, Flex, Grid } from '@chakra-ui/react'
import { SheetInput } from '../shared/SheetInput'
import { SheetSelect } from '../shared/SheetSelect'
import { Card } from '../shared/Card'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useChangePilotClass } from '../../hooks/pilot/useChangePilotClass'
import { useChangePilotHybridClass } from '../../hooks/pilot/useChangePilotHybridClass'
import { useHydratedPilot, useUpdatePilot } from '../../hooks/pilot'
import { Text } from '../base/Text'
import { rollTable } from '@randsum/salvageunion'
import { checkTreeRequirements } from './utils/checkTreeRequirements'

interface PilotInfoInputsProps {
  /** Disables all inputs */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
  id: string
}

export function PilotInfoInputs({
  id,
  disabled = false,
  incomplete = false,
}: PilotInfoInputsProps) {
  const { pilot, abilities, selectedClass, selectedAdvancedClass } = useHydratedPilot(id)
  const onClassChange = useChangePilotClass(id)
  const onHybridClassChange = useChangePilotHybridClass(id)
  const updatePilot = useUpdatePilot()
  const motto = pilot?.motto ?? ''
  const mottoUsed = pilot?.motto_used ?? false
  const keepsake = pilot?.keepsake ?? ''
  const keepsakeUsed = pilot?.keepsake_used ?? false
  const background = pilot?.background ?? ''
  const backgroundUsed = pilot?.background_used ?? false
  const appearance = pilot?.appearance ?? ''
  const callsign = pilot?.callsign
  const classId = selectedClass?.schema_ref_id ?? null
  const advancedClassId = selectedAdvancedClass?.schema_ref_id ?? null
  const allClasses = useMemo(() => SalvageUnionReference.Classes.all(), [])

  // Filter base classes (have coreTrees) for initial class dropdown
  // Hybrid classes (hybrid === true) cannot be selected as initial class
  const sortedCoreClasses = useMemo(() => {
    const baseClasses = allClasses.filter(
      (cls) =>
        'coreTrees' in cls &&
        Array.isArray(cls.coreTrees) &&
        ('hybrid' in cls ? cls.hybrid !== true : true)
    )
    return [...baseClasses].sort((a, b) => a.name.localeCompare(b.name))
  }, [allClasses])

  // Check if user has selected core class advanced tree abilities
  const hasCoreAdvancedAbilities = useMemo(() => {
    if (!selectedClass?.ref) return false
    const coreClassRef = selectedClass.ref as { advancedTree?: string }
    if (!coreClassRef.advancedTree) return false

    return abilities.some((ability) => {
      const abilityTree = (ability.ref as { tree: string }).tree
      return abilityTree === coreClassRef.advancedTree
    })
  }, [abilities, selectedClass])

  // Calculate class display text for pseudo-header
  const classDisplayText = useMemo(() => {
    if (!selectedClass?.ref) return null

    const coreClassName = (selectedClass.ref as { name: string }).name

    // If hybrid class is selected
    if (selectedAdvancedClass?.ref) {
      const hybridClassName = (selectedAdvancedClass.ref as { name: string }).name
      return {
        main: hybridClassName,
        sub: coreClassName,
      }
    }

    // If core class with advanced abilities
    if (hasCoreAdvancedAbilities) {
      return {
        main: coreClassName,
        sub: 'Adv.',
      }
    }

    // Just core class
    return {
      main: coreClassName,
      sub: null,
    }
  }, [selectedClass, selectedAdvancedClass, hasCoreAdvancedAbilities])

  // Filter hybrid classes for hybrid dropdown
  const availableHybridClasses = useMemo(() => {
    // Must have at least 6 abilities
    if (abilities.length < 6) {
      return []
    }

    // Base class must be advanceable - if not advanceable, never enable hybrid selector
    if (
      selectedClass?.ref &&
      'advanceable' in selectedClass.ref &&
      selectedClass.ref.advanceable === false
    ) {
      return []
    }

    // If user has any advanced or legendary abilities from core class, disable hybrid dropdown
    if (selectedClass?.ref) {
      const coreClassRef = selectedClass.ref as {
        advancedTree?: string
        legendaryTree?: string
      }
      const hasCoreAdvancedOrLegendaryAbilities = abilities.some((ability) => {
        const abilityTree = (ability.ref as { tree: string }).tree
        return (
          abilityTree === coreClassRef.advancedTree || abilityTree === coreClassRef.legendaryTree
        )
      })

      if (hasCoreAdvancedOrLegendaryAbilities) {
        return []
      }
    }

    // Get only hybrid classes (hybrid === true)
    const hybridClasses = allClasses.filter((cls) => {
      return 'hybrid' in cls && cls.hybrid === true
    })

    // Filter hybrid classes that meet requirements (at least one requirement tree completed)
    const available = hybridClasses
      .filter((hybridClass) => {
        const advancedTree =
          'advancedTree' in hybridClass && hybridClass.advancedTree
            ? hybridClass.advancedTree
            : null
        if (!advancedTree) return false

        // Check if requirements are met using shared utility
        return checkTreeRequirements(abilities, advancedTree)
      })
      .map((hybridClass) => {
        return {
          id: hybridClass.id,
          name: hybridClass.name,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return available
  }, [abilities, selectedClass, allClasses])

  const handleMottoRoll = async () => {
    const {
      result: { label },
    } = rollTable('Motto')
    updatePilot.mutate({ id, updates: { motto: label } })
  }

  const handleKeepsakeRoll = async () => {
    const {
      result: { label },
    } = rollTable('Keepsake')
    updatePilot.mutate({ id, updates: { keepsake: label } })
  }

  const handleAppearanceRoll = async () => {
    const {
      result: { label },
    } = rollTable('Pilot Appearance')
    updatePilot.mutate({ id, updates: { appearance: label } })
  }

  return (
    <Card
      title={callsign ?? 'New Pilot'}
      subTitleContent={<Text></Text>}
      bg="bg.builder.pilot"
      flex="1"
      minW="0"
      disabled={incomplete}
      absoluteElements={
        classDisplayText ? (
          <Text
            position="absolute"
            variant="pseudoheader"
            fontSize="sm"
            textTransform="uppercase"
            ml={3}
            mt={-2}
            left={0}
          >
            {classDisplayText.main}
            {classDisplayText.sub && (
              <>
                {' '}
                <Text as="span" fontSize="xs" variant="pseudoheader">
                  ({classDisplayText.sub})
                </Text>
              </>
            )}
          </Text>
        ) : null
      }
    >
      <Grid gridTemplateColumns="repeat(2, 1fr)" gap={4} w="full" h="full">
        <SheetInput
          label="Callsign"
          value={callsign ?? ''}
          onChange={(value) => updatePilot.mutate({ id, updates: { callsign: value } })}
          placeholder="Enter callsign"
          disabled={disabled}
          isOwner={!disabled}
        />

        <SheetInput
          label="Motto"
          value={motto}
          onChange={(value) => updatePilot.mutate({ id, updates: { motto: value } })}
          placeholder="Enter motto"
          disabled={disabled}
          isOwner={!disabled}
          toggleChecked={mottoUsed}
          onToggleChange={(value) => updatePilot.mutate({ id, updates: { motto_used: value } })}
          onDiceRoll={handleMottoRoll}
          diceRollAriaLabel="Roll on the Motto table"
          diceRollTitle="Roll on the Motto table"
        />

        <Flex gap={4} h="full">
          <Box flex="1" h="full">
            <SheetSelect
              label="Class"
              value={classId}
              onChange={onClassChange}
              disabled={disabled}
              isOwner={!disabled}
              placeholder="Select..."
            >
              {sortedCoreClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </SheetSelect>
          </Box>

          <Box flex="1" h="full">
            {hasCoreAdvancedAbilities ? (
              <SheetInput
                label="Advanced Class"
                value={`Advanced ${selectedClass?.ref?.name ?? ''}`}
                onChange={() => {}}
                disabled={true}
                isOwner={false}
                placeholder=""
              />
            ) : (
              <SheetSelect
                label="Hybrid Class"
                value={advancedClassId}
                onChange={onHybridClassChange}
                disabled={disabled || availableHybridClasses.length === 0}
                isOwner={!disabled}
                placeholder="Select..."
              >
                {availableHybridClasses.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SheetSelect>
            )}
          </Box>
        </Flex>

        <SheetInput
          label="Keepsake"
          value={keepsake}
          onChange={(value) => updatePilot.mutate({ id, updates: { keepsake: value } })}
          placeholder="Enter keepsake"
          disabled={disabled}
          isOwner={!disabled}
          toggleChecked={keepsakeUsed}
          onToggleChange={(value) => updatePilot.mutate({ id, updates: { keepsake_used: value } })}
          onDiceRoll={handleKeepsakeRoll}
          diceRollAriaLabel="Roll on the Keepsake table"
          diceRollTitle="Roll on the Keepsake table"
        />

        <SheetInput
          label="Appearance"
          value={appearance}
          onChange={(value) => updatePilot.mutate({ id, updates: { appearance: value } })}
          placeholder="Enter appearance"
          disabled={disabled}
          isOwner={!disabled}
          onDiceRoll={handleAppearanceRoll}
          diceRollAriaLabel="Roll on the Pilot Appearance table"
          diceRollTitle="Roll on the Pilot Appearance table"
        />

        <SheetInput
          label="Background"
          value={background}
          onChange={(value) => updatePilot.mutate({ id, updates: { background: value } })}
          placeholder="Enter background"
          disabled={disabled}
          isOwner={!disabled}
          toggleChecked={backgroundUsed}
          onToggleChange={(value) =>
            updatePilot.mutate({ id, updates: { background_used: value } })
          }
        />
      </Grid>
    </Card>
  )
}
