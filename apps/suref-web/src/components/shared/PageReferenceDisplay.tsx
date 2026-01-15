import { Flex } from '@chakra-ui/react'
import { getDisplayName, isAbility } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { useEntityDisplayContext } from '../entity/EntityDisplay/useEntityDisplayContext'

export function EntityDisplayFooter({ bg }: { bg?: string }) {
  const { data, schemaName, spacing, compact } = useEntityDisplayContext()
  if (!('page' in data) || !data.page) return null
  const displayName = getDisplayName(schemaName)

  // Get tree name for abilities
  const treeName = isAbility(data) && 'tree' in data && data.tree ? String(data.tree) : undefined

  const fontWeightBold = compact ? 'semibold' : 'bold'
  const fontWeightSemibold = 'semibold'
  return (
    <Flex
      p={spacing.contentPadding}
      color="su.black"
      justifyContent="space-between"
      alignItems="center"
      w="full"
      gap={4}
      bg={bg ?? 'transparent'}
    >
      <Flex gap={2} alignItems="center" flex="0 1 auto" minW="0">
        {displayName && (
          <Text
            variant="pseudoheader"
            fontWeight={fontWeightBold}
            textTransform="uppercase"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            fontSize="xs"
            flexShrink={0}
          >
            {displayName}
          </Text>
        )}
        {treeName && (
          <Text
            variant="pseudoheader"
            fontWeight={fontWeightSemibold}
            textTransform="uppercase"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            fontSize="xs"
            flex="0 1 auto"
            minW="0"
          >
            {treeName}
          </Text>
        )}
      </Flex>

      <Flex>
        <Text
          variant="pseudoheader"
          as="span"
          mr={4}
          fontSize="xs"
          fontWeight={fontWeightSemibold}
          textTransform="uppercase"
        >
          {data.source}
        </Text>
        <Text variant="pseudoheader" as="span" fontSize="xs" fontWeight={fontWeightBold}>
          Page {data.page}
        </Text>
      </Flex>
    </Flex>
  )
}
