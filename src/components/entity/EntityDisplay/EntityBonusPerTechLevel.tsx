import { VStack } from '@chakra-ui/react'
import { EntityStats } from './EntityStats'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export function EntityBonusPerTechLevel() {
  const { data, spacing } = useEntityDisplayContext()
  const showBPTL = 'bonusPerTechLevel' in data && data.bonusPerTechLevel && data.bonusPerTechLevel

  if (!showBPTL) return null

  return (
    <VStack
      p={spacing.contentPadding}
      gap={spacing.smallGap}
      alignItems="stretch"
      borderRadius="md"
    >
      {data.bonusPerTechLevel && (
        <EntityStats label="Bonus Per Tech Level" prefix="+" data={data.bonusPerTechLevel} />
      )}
    </VStack>
  )
}
