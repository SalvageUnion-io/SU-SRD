import { VStack } from '@chakra-ui/react'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { NestedChassisAbility } from '../NestedChassisAbility'

export function EntityChassisAbilitiesContent() {
  const { data, spacing, compact, chassisAbilities } = useEntityDisplayContext()

  if (!chassisAbilities || chassisAbilities.length === 0) return null

  // Get chassis name from data
  const chassisName = 'name' in data ? data.name : undefined

  return (
    <VStack gap={spacing.smallGap} p="2" alignItems="stretch">
      {chassisAbilities.map((ability) => {
        return (
          <NestedChassisAbility
            compact={compact}
            key={ability.id}
            data={ability}
            chassisName={chassisName}
          />
        )
      })}
    </VStack>
  )
}
