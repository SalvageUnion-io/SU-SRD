import { Flex, Box } from '@chakra-ui/react'
import { Text } from '../../base/Text'
import { isAbility } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'

export function EntityRightHeaderContent({
  collapsible,
  isExpanded,
}: {
  isExpanded: boolean
  collapsible: boolean
}) {
  const { data, compact, fontSize, rightContent } = useEntityDisplayContext()
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  const abilityContent = description && isAbility(data) && (
    <Box
      color="su.white"
      fontStyle="italic"
      textAlign="right"
      fontWeight="medium"
      maxH="60px"
      minW="0"
      fontSize={fontSize.xs}
      flexShrink="1"
      whiteSpace="normal"
      lineHeight="shorter"
      maxW={compact ? '175px' : undefined}
      flexWrap="wrap"
      overflow="hidden"
    >
      {parsedDescription}
    </Box>
  )

  return (
    <Flex gap={2}>
      {abilityContent}
      <EntityStats data={data} />
      {rightContent}
      {collapsible && (
        <Flex
          alignItems="center"
          justifyContent="center"
          minW="25px"
          alignSelf="center"
          flexShrink={0}
        >
          <Text color="su.white" fontSize="lg">
            {isExpanded ? '▼' : '▶'}
          </Text>
        </Flex>
      )}
    </Flex>
  )
}
