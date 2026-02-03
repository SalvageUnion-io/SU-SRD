import { Box, Flex, Text } from '@chakra-ui/react'
import { Button } from '@chakra-ui/react'
import { Heading } from '../base/Heading'

interface NotFoundDisplayProps {
  /** The type of entity that was not found (e.g., "System", "Module") */
  entityType?: string
  /** The ID or name that was searched for */
  entityId?: string
  /** Optional callback when user clicks close/dismiss */
  onClose?: () => void
}

/**
 * Display component shown when an entity cannot be found in the reference data.
 * Styled to match the existing error component aesthetic.
 */
export function NotFoundDisplay({ entityType, entityId, onClose }: NotFoundDisplayProps) {
  return (
    <Flex alignItems="center" justifyContent="center" minH="200px" p={4}>
      <Box
        maxW="md"
        w="full"
        p={6}
        bg="su.lightBlue"
        borderRadius="md"
        shadow="lg"
        borderWidth="2px"
        borderColor="brand.srd"
      >
        <Heading level="h2" fontSize="xl" fontWeight="bold" mb={4}>
          DATA NOT FOUND
        </Heading>
        <Text color="su.black" mb={4}>
          {entityType && entityId
            ? `The ${entityType} "${entityId}" could not be found in the reference data.`
            : entityId
              ? `The item "${entityId}" could not be found in the reference data.`
              : 'The requested item could not be found in the reference data.'}
        </Text>
        <Text color="su.black" fontSize="sm" mb={4}>
          This may be a broken link or the data may have been removed.
        </Text>
        {onClose && (
          <Button
            onClick={onClose}
            w="full"
            px={4}
            py={2}
            bg="su.orange"
            color="su.white"
            borderRadius="md"
            _hover={{ bg: 'brand.srd' }}
            fontWeight="medium"
          >
            Close
          </Button>
        )}
      </Box>
    </Flex>
  )
}
