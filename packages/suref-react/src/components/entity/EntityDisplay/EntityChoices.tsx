import type { SURefEntity, SURefObjectChoice } from 'salvageunion-reference'
import { getChoices } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { EntityChoice } from './EntityChoice'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing, getEntityFontSizes } from './entityDisplayTypes'

export type EntityChoicesProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getEntitySpacing>
  fontSize: ReturnType<typeof getEntityFontSizes>
  hideChoices: boolean
  /** User choices object matching the format sent to the API: Record<choiceId, "schemaName||entityId"> */
  userChoices?: Record<string, string> | null
  /** Callback when a choice is selected - if undefined, we're in schema page mode (not a live sheet) */
  onChoiceSelection?: (choiceId: string, value: string | undefined) => void
}

export function EntityChoices({
  data,
  spacing,
  fontSize,
  hideChoices,
  userChoices,
  onChoiceSelection,
}: EntityChoicesProps) {
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
      <div className="rounded-md bg-su-white">
        <Text className={cn('font-bold text-su-black', fontSize.md)}>
          WIP - Live sheet choices will be displayed here
        </Text>
      </div>
    )
  }

  return (
    <div className={cn(spacing.smallSpaceYClass)}>
      {entityChoices.map((choice) => {
        return (
          <EntityChoice
            key={choice.id}
            choice={choice}
            userChoices={userChoices}
            onChoiceSelection={onChoiceSelection}
            fontSize={fontSize}
            spacing={spacing}
          />
        )
      })}
    </div>
  )
}
