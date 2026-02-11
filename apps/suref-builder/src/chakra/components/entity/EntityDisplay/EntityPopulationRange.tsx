import { Box, Text } from '@chakra-ui/react'
import { useEntityDisplayContext } from './useEntityDisplayContext'

/**
 * Displays population range for crawler-tech-levels schema
 */
export function EntityPopulationRange() {
  const { data, schemaName, spacing } = useEntityDisplayContext()

  if (schemaName !== 'crawler-tech-levels') return null

  if (
    !('populationMin' in data) ||
    !('populationMax' in data) ||
    typeof data.populationMin !== 'number' ||
    typeof data.populationMax !== 'number'
  ) {
    return null
  }

  return (
    <Box
      bg="su.white"
      borderWidth="2px"
      borderColor="su.black"
      borderRadius="md"
      p={spacing.smallGap}
    >
      <Text color="su.black">
        <Text as="span" fontWeight="bold" color="brand.srd">
          Population Range:{' '}
        </Text>
        {data.populationMin.toLocaleString()} - {data.populationMax.toLocaleString()}
      </Text>
    </Box>
  )
}
