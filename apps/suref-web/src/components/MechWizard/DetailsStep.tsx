import { useCallback, useEffect, useMemo } from 'react'
import { Box, VStack, Button, Separator } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { SheetInput } from '../shared/SheetInput'
import { SheetTextarea } from '../shared/SheetTextarea'
import { normalizePatternName } from 'salvageunion-reference'
import type { UseMechWizardStateReturn } from './useMechWizardState'

interface DetailsStepProps {
  wizardState: UseMechWizardStateReturn
  onCreateMech: () => void
}

export function DetailsStep({ wizardState, onCreateMech }: DetailsStepProps) {
  const { state, setAppearance, setQuirk, setPatternName } = wizardState

  // Pre-fill pattern name if a pattern was selected
  useEffect(() => {
    if (state.selectedPatternName && !state.patternName) {
      setPatternName(state.selectedPatternName)
    }
  }, [state.selectedPatternName, state.patternName, setPatternName])

  // Create placeholder from normalized pattern name
  const patternPlaceholder = useMemo(() => {
    if (state.selectedPatternName) {
      return normalizePatternName(state.selectedPatternName)
    }
    return 'Enter pattern name'
  }, [state.selectedPatternName])

  const isComplete = !!state.appearance.trim() && !!state.quirk.trim() && !!state.patternName.trim()

  const handleCreate = useCallback(() => {
    if (isComplete) {
      onCreateMech()
    }
  }, [isComplete, onCreateMech])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={4} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Mech Details
        </Text>

        <VStack gap={0} align="stretch" w="full">
          {/* Pattern Name Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Pattern Name
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Give your mech a pattern name. This can be the name of a pattern you selected, or a
                custom name for your unique build.
              </Text>
              <SheetInput
                label=""
                value={state.patternName}
                onChange={setPatternName}
                placeholder={patternPlaceholder}
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Appearance Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Mech Appearance
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Describe the appearance of your mech. What does it look like? What colors, markings,
                or distinctive features does it have?
              </Text>
              <SheetTextarea
                label=""
                value={state.appearance}
                onChange={setAppearance}
                placeholder="Enter mech appearance"
                rows={4}
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Quirk Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Quirk
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Every mech has a quirk - a unique characteristic, flaw, or feature that makes it
                special. What makes your mech unique?
              </Text>
              <SheetTextarea
                label=""
                value={state.quirk}
                onChange={setQuirk}
                placeholder="Enter mech quirk"
                rows={3}
              />
            </VStack>
          </Box>
        </VStack>
      </VStack>

      <Button
        w="full"
        bg={isComplete ? 'su.orange' : 'gray.400'}
        color="su.white"
        borderWidth="3px"
        borderColor="su.black"
        borderRadius="md"
        fontSize="lg"
        fontWeight="bold"
        py={6}
        _hover={isComplete ? { bg: 'su.black' } : {}}
        disabled={!isComplete}
        onClick={handleCreate}
      >
        CREATE MECH
      </Button>
    </VStack>
  )
}
