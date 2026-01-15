import { Box, Flex, HStack, VStack } from '@chakra-ui/react'
import { getTechLevel, type SURefChassis } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { StatDisplay } from '../StatDisplay'
import { MechResourceSteppers } from '../MechLiveSheet/MechResourceSteppers'
import { useHydratedMech } from '../../hooks/mech'

interface ActiveMechDisplayProps {
  mechId: string
  isEditable: boolean
}

export function ActiveMechDisplay({ mechId, isEditable }: ActiveMechDisplayProps) {
  const { mech, selectedChassis } = useHydratedMech(mechId)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const chassisName = chassisRef?.name
  const pattern = mech?.pattern ?? undefined

  const title = chassisName && pattern ? `"${pattern}"` : chassisName || 'Mech Chassis'
  const subtitle = pattern && chassisName ? `${chassisName} Chassis` : ''

  // Get tech level for display (preserves "B" and "N")
  const techLevelDisplay = chassisRef ? (getTechLevel(chassisRef) ?? 0) : 0
  const isBioTechLevel = techLevelDisplay === 'B'
  const isNTechLevel = techLevelDisplay === 'N'

  return (
    <Box w="full" borderWidth="3px" borderColor="su.green" borderRadius="md" p={4} bg="su.green">
      <Flex
        gap={4}
        direction={{ base: 'column', lg: 'row' }}
        alignItems={{ base: 'stretch', lg: 'stretch' }}
      >
        <VStack flex="1" gap={2} alignItems="stretch">
          <HStack gap={4} alignItems="center">
            <StatDisplay
              inverse={!isBioTechLevel && !isNTechLevel}
              bg={isBioTechLevel ? 'su.sicklyYellow' : isNTechLevel ? 'su.silver' : undefined}
              valueColor={isBioTechLevel ? 'su.black' : isNTechLevel ? 'su.black' : undefined}
              label="tech"
              bottomLabel="Level"
              value={techLevelDisplay}
              disabled={!selectedChassis}
            />
            <VStack alignItems="flex-start" gap={0}>
              <Text variant="pseudoheader" fontSize="lg">
                {title}
              </Text>
              {subtitle && (
                <Text variant="pseudoheader" fontSize="sm">
                  {subtitle}
                </Text>
              )}
            </VStack>
          </HStack>
        </VStack>

        <MechResourceSteppers id={mechId} disabled={!isEditable} incomplete={!selectedChassis} />
      </Flex>
    </Box>
  )
}
