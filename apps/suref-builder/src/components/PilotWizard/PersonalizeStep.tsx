import { useCallback } from 'react'
import { Box, VStack, Button, Separator } from '@chakra-ui/react'
import { Text, SheetInput } from '../../chakra'
import { SheetTextarea } from '../shared/SheetTextarea'
import type { UsePilotWizardStateReturn } from './usePilotWizardState'

interface PersonalizeStepProps {
  wizardState: UsePilotWizardStateReturn
  onCreatePilot: () => void
}

export function PersonalizeStep({ wizardState, onCreatePilot }: PersonalizeStepProps) {
  const { state, updateField } = wizardState

  const isComplete =
    !!state.callsign.trim() &&
    !!state.background.trim() &&
    !!state.motto.trim() &&
    !!state.keepsake.trim() &&
    !!state.appearance.trim()

  const handleCreate = useCallback(() => {
    if (isComplete) {
      onCreatePilot()
    }
  }, [isComplete, onCreatePilot])

  return (
    <VStack gap={6} align="stretch" w="full">
      <VStack gap={4} align="center" w="full">
        <Text variant="pseudoheader" fontSize="2xl" textAlign="center" textTransform="uppercase">
          Pilot Details
        </Text>

        <VStack gap={0} align="stretch" w="full">
          {/* Callsign Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Callsign
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Your Pilot's Callsign is the name everyone on the Union Crawler refers to them as.
                It is typically a nickname, but can be their actual name. Pick or roll on the
                Callsign Table, or have everyone else at the table choose one for your Pilot based
                on their impression of them. Callsigns may also change in play in this manner.
              </Text>
              <SheetInput
                label=""
                value={state.callsign}
                onChange={(value) => updateField('callsign', value)}
                placeholder="Enter callsign"
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Background Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Background
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Your Pilot's Background is where they came from before they joined the Union
                Crawler. They may have been a wastelander, a member of the corpos, a wanderer, or
                even a born salvager. If a Pilot takes an action that aligns with their Background
                they may re-roll the dice on the action, accepting the second result. This Ability
                can be used once, a Pilot regains the use of this Ability following Downtime.
              </Text>
              <SheetTextarea
                label=""
                value={state.background}
                onChange={(value) => updateField('background', value)}
                placeholder="Enter background"
                rows={4}
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Motto Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Motto
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Your Pilot's Motto is a phrase they happen to be fond of using. They may say this
                phrase, as a Free Action or Reaction, at a time during the game that feels
                appropriate, and another Pilot may re-roll the dice, accepting the second result.
                This Ability can be used once, a Pilot regains the use of this Ability following
                Downtime.
              </Text>
              <SheetTextarea
                label=""
                value={state.motto}
                onChange={(value) => updateField('motto', value)}
                placeholder="Enter motto"
                rows={3}
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Keepsake Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Keepsake
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Your Pilot's Keepsake is an item that is personal and important to them. It could be
                an old photograph, a childhood bobblehead toy, or a music mixtape from an old
                sweetheart. Consider why this Keepsake is important and what it means to your Pilot.
                If a Pilot takes an action that aligns with why their Keepsake is important to them,
                they may re-roll the dice on the action, accepting the second result. This Ability
                can be used once, a Pilot regains the use of this Ability following Downtime.
              </Text>
              <SheetTextarea
                label=""
                value={state.keepsake}
                onChange={(value) => updateField('keepsake', value)}
                placeholder="Enter keepsake"
                rows={3}
              />
            </VStack>
            <Separator mt={4} />
          </Box>

          {/* Appearance Row */}
          <Box py={4}>
            <VStack gap={2} align="stretch">
              <Text variant="pseudoheader" fontSize="sm" textTransform="uppercase">
                Appearance
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Briefly describe the appearance of your Pilot, and consider their gender and
                pronouns. Are they alluring, fancy, glamorous, tall, stocky, sloppy, or
                intimidating? Do they have any iconic features such as scars, wildly spiked hair, a
                mischievous grin, or crooked teeth? What type of clothing do they wear? Do they go
                by she, he, they, or something else?
              </Text>
              <SheetTextarea
                label=""
                value={state.appearance}
                onChange={(value) => updateField('appearance', value)}
                placeholder="Enter appearance"
                rows={5}
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
        MEET {state.callsign.trim() || 'YOUR PILOT'}
      </Button>
    </VStack>
  )
}
