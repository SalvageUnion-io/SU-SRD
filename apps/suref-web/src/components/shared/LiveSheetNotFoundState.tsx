import { Flex, Text } from '@chakra-ui/react'
import { LiveSheetLayout } from './LiveSheetLayout'

interface LiveSheetNotFoundStateProps {
  entityType: 'Mech' | 'Pilot' | 'Crawler'
}

export function LiveSheetNotFoundState({ entityType }: LiveSheetNotFoundStateProps) {
  return (
    <LiveSheetLayout>
      <Flex alignItems="center" justifyContent="center" h="64">
        <Text fontSize="xl" fontFamily="mono">
          {entityType} not found
        </Text>
      </Flex>
    </LiveSheetLayout>
  )
}
