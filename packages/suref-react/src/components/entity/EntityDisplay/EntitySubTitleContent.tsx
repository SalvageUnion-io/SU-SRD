import { Flex } from '@chakra-ui/react'
import { getActivationCurrency } from '../entityDisplayHelpers'
import { extractEntityDetails } from '../../../lib/entityDataExtraction'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { SharedDetailItem } from './sharedDetailItem'

export function EntitySubTitleElement() {
  const { data, schemaName, spacing, compact } = useEntityDisplayContext()

  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractEntityDetails(data, schemaName, currency)
  if (values.length === 0) return null

  return (
    <Flex gap={spacing.minimalGap} flexWrap="wrap" alignItems="center">
      {values.map((item, index) => (
        <SharedDetailItem key={index} item={item} compact={compact} />
      ))}
    </Flex>
  )
}
