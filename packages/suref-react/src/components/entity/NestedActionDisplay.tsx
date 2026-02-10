import { Box, Flex, VStack } from '@chakra-ui/react'
import type { SURefMetaAction, SURefObjectChoice } from 'salvageunion-reference'
import { getEntityDisplayName } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { EntityChoice } from './EntityDisplay/EntityChoice'
import { extractEntityDetails } from '../../lib/entityDataExtraction'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'

interface NestedActionDisplayProps {
  /** Action data from salvageunion-reference */
  data: SURefMetaAction
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the action content/description */
  hideContent?: boolean
}

/**
 * NestedActionDisplay - Renders sub-actions in a visually subordinate style
 *
 * Used for rendering nested actions from entity.actions arrays.
 * Visually distinct from EntityDisplay with:
 * - Border to separate from main content
 * - Simpler, more compact layout
 * - Lower visual priority than full EntityDisplay
 *
 * Matches the rulebook pattern where main abilities use EntityDisplay
 * and sub-actions use this component.
 */
export function NestedActionDisplay({
  data,
  compact = false,
  hideContent = false,
}: NestedActionDisplayProps) {
  // Regular actions use AP currency
  const details = extractEntityDetails(data, undefined, 'AP')

  // Match EntityDisplay fontSize.sm: compact ? 'xs' : 'sm'
  const fontSize = compact ? 'xs' : 'sm'
  const titleFontSize = compact ? 'sm' : 'xl'
  const spacing = compact ? 1 : 2
  const headerPadding = compact ? { px: 0.5, py: 0.25 } : { px: 1, py: 0.5 }

  const hasContent = data.content && data.content.length > 0
  const actionChoices: SURefObjectChoice[] = data.choices || []
  const hasChoices = actionChoices.length > 0
  const hasTable = data.table !== undefined && data.table !== null

  // Default variant: light blue background with details
  // Always render data row on a new line, regardless of content blocks
  const hasContentToRender = hasContent && !hideContent

  const displayName = getEntityDisplayName(data) || data.name

  return (
    <Box bg="transparent" overflow="hidden">
      <Flex bg="transparent" p={spacing} gap={spacing} alignItems="center" flexWrap="wrap">
        <Text
          fontSize={titleFontSize}
          variant="pseudoheader"
          width="fit-content"
          {...headerPadding}
        >
          {displayName}
        </Text>
      </Flex>

      {/* Detail row - always on new line for default variant */}
      {details.length > 0 && (
        <Flex
          gap={compact ? 0.5 : 1}
          flexWrap="wrap"
          alignItems="center"
          p={spacing}
          pt={0}
          direction="row"
        >
          {details.map((item, index) => (
            <DataValueDisplayView key={index} item={item} compact={compact} damaged={false} />
          ))}
        </Flex>
      )}

      {hasContentToRender && (
        <VStack
          gap={spacing}
          p={spacing}
          pt={details.length > 0 ? 0 : spacing}
          alignItems="stretch"
        >
          <BlockContentRendererView
            content={data.content!}
            fontSize={fontSize}
            compact={compact}
            damaged={false}
          />
        </VStack>
      )}

      {hasTable && (
        <Box
          p={spacing}
          pt={hasContentToRender && !hideContent ? 0 : details.length > 0 ? 0 : spacing}
          borderRadius="md"
          position="relative"
          zIndex={10}
        >
          <RollTable
            disabled={false}
            table={data.table!}
            showCommand
            compact
            tableName={displayName}
          />
        </Box>
      )}

      {hasChoices && (
        <VStack
          gap={spacing}
          p={spacing}
          pt={
            hasContentToRender && !hideContent ? 0 : hasTable ? 0 : details.length > 0 ? 0 : spacing
          }
          alignItems="stretch"
        >
          {actionChoices.map((choice) => (
            <EntityChoice
              key={choice.id}
              choice={choice}
              userChoices={undefined}
              onChoiceSelection={undefined}
            />
          ))}
        </VStack>
      )}
    </Box>
  )
}
