import { VStack } from '@chakra-ui/react'
import { getTechLevel, type SURefChassis } from 'salvageunion-reference'
import { Card } from '../shared/Card'
import { StatDisplay } from '../StatDisplay'
import { ChassisInputs } from './ChassisInputs'
import { useHydratedMech } from '../../hooks/mech'
import { Text } from '../base/Text'

export function MainMechDisplay({ id, isEditable }: { id: string; isEditable: boolean }) {
  const { mech, selectedChassis } = useHydratedMech(id)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const chassisName = chassisRef?.name
  const pattern = mech?.pattern ?? undefined

  const title = chassisName && pattern ? `"${pattern}"` : chassisName || 'Mech Chassis'
  const subtitle = pattern && chassisName ? `${chassisName} Chassis` : ''

  // Get tech level for display (preserves "B" and "N")
  const techLevelDisplay = chassisRef ? (getTechLevel(chassisRef) ?? 0) : 0
  const isBioTechLevel = techLevelDisplay === 'B'
  const isNTechLevel = techLevelDisplay === 'N'
  const bgColor = 'su.green' // Always green for mech chassis header

  return (
    <VStack flex="1" gap={2} alignItems="stretch">
      <Card
        leftContent={
          <StatDisplay
            inverse={!isBioTechLevel && !isNTechLevel}
            bg={isBioTechLevel ? 'su.sicklyYellow' : isNTechLevel ? 'su.silver' : undefined}
            valueColor={isBioTechLevel ? 'su.black' : isNTechLevel ? 'su.black' : undefined}
            label="tech"
            bottomLabel="Level"
            value={techLevelDisplay}
            disabled={!selectedChassis}
            hoverText="A Mech's Tech Level broadly represents how advanced it is. There are 6 Tech Levels, and Mechs of higher Tech Levels tend to be more powerful with higher statistics in one or multiple areas. Consequently, higher Tech Mechs are more expensive to build, upkeep, and repair."
          />
        }
        title={title}
        subTitleContent={<Text variant="pseudoheader">{subtitle}</Text>}
        bg={bgColor}
        w="full"
        h="full"
        disabled={!selectedChassis}
      >
        <ChassisInputs id={id} isEditable={isEditable} />
      </Card>
    </VStack>
  )
}
