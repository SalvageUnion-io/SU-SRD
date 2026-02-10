import { Flex, Text } from '@chakra-ui/react'
import { LiveSheetLayout } from './LiveSheetLayout'

interface LiveSheetLoadingStateProps {
  entityType: 'Mech' | 'Pilot' | 'Crawler'
}

export function LiveSheetLoadingState({ entityType }: LiveSheetLoadingStateProps) {
  return (
    <LiveSheetLayout>
      <Flex alignItems="center" justifyContent="center" h="64">
        <Text fontSize="xl" fontFamily="mono">
          Loading {entityType.toLowerCase()}...
        </Text>
      </Flex>
    </LiveSheetLayout>
  )
}
