import { Box, VStack } from '@chakra-ui/react'
import { Text } from '../../base/Text'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { getChoices } from 'salvageunion-reference'
import { EntityChoice } from './EntityChoice'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export interface EntityChoicesProps {
  /** User choices object matching the format sent to the API: Record<choiceId, "schemaName||entityId"> */
  userChoices?: Record<string, string> | null
  /** Callback when a choice is selected - if undefined, we're in schema page mode (not a live sheet) */
  onChoiceSelection?: (choiceId: string, value: string | undefined) => void
}

export function EntityChoices({ userChoices, onChoiceSelection }: EntityChoicesProps) {
  const { data, spacing, fontSize, hideChoices } = useEntityDisplayContext()

  // Get choices using the utility function (checks single action first, then root-level)
  const entityChoices: SURefObjectChoice[] = getChoices(data) || []

  if (entityChoices.length === 0) {
    return null
  }

  // Don't render choices if hideChoices is true
  if (hideChoices) {
    return null
  }

  const isSchemaPageMode = onChoiceSelection === undefined

  if (!isSchemaPageMode) {
    return (
      <Box p={spacing.contentPadding} bg="su.white" borderRadius="md">
        <Text fontSize={fontSize.md} fontWeight="bold" color="su.black">
          WIP - Live sheet choices will be displayed here
        </Text>
      </Box>
    )
  }

  return (
    <VStack gap={spacing.smallGap} alignItems="stretch" px="2" pb={spacing.contentPadding * 2}>
      {entityChoices.map((choice) => {
        return (
          <EntityChoice
            key={choice.id}
            choice={choice}
            userChoices={userChoices}
            onChoiceSelection={onChoiceSelection}
          />
        )
      })}
    </VStack>
  )
}
