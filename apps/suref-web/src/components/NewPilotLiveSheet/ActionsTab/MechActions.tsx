import { VStack } from '@chakra-ui/react'
import type { SURefMetaAction } from 'salvageunion-reference'
import { NestedActionDisplay } from '../../entity/NestedActionDisplay'

interface MechActionsProps {
  actions: SURefMetaAction[]
}

export function MechActions({ actions }: MechActionsProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <VStack gap={3} alignItems="stretch">
      {actions.map((action) => (
        <NestedActionDisplay key={action.id} data={action} compact={false} hideContent={false} />
      ))}
    </VStack>
  )
}
