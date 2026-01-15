import { VStack } from '@chakra-ui/react'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { NestedActionDisplay } from '../NestedActionDisplay'

export function EntityActions() {
  const {
    schemaName,
    spacing,
    compact,
    hasActions: hasActionsValue,
    actionsToDisplay,
  } = useEntityDisplayContext()

  // Chassis now use chassisAbilities instead of actions
  if (schemaName === 'chassis') return null

  if (!hasActionsValue) return null

  if (!actionsToDisplay || actionsToDisplay.length === 0) return null

  return (
    <VStack gap={spacing.smallGap} alignItems="stretch" borderRadius="md">
      {actionsToDisplay.map((action) => {
        return <NestedActionDisplay compact={compact} key={action.id} data={action} />
      })}
    </VStack>
  )
}
