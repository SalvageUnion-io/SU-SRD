import { Flex, Text, VStack } from '@chakra-ui/react'
import { LiveSheetLayout } from './LiveSheetLayout'
import { PermissionError } from './PermissionError'

interface LiveSheetErrorStateProps {
  entityType: 'Mech' | 'Pilot' | 'Crawler'
  error: string
}

export function LiveSheetErrorState({ entityType, error }: LiveSheetErrorStateProps) {
  if (error.includes('permission') || error.includes('private') || error.includes('access')) {
    return <PermissionError message={error} />
  }

  return (
    <LiveSheetLayout>
      <Flex alignItems="center" justifyContent="center" h="64">
        <VStack textAlign="center">
          <Text fontSize="xl" fontFamily="mono" color="red.600" mb={4}>
            Error loading {entityType.toLowerCase()}
          </Text>
          <Text fontSize="sm" fontFamily="mono" color="gray.600">
            {error}
          </Text>
        </VStack>
      </Flex>
    </LiveSheetLayout>
  )
}
