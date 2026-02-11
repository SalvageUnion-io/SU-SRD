import { Text } from '../../base/Text'
import type { SURefObjectChoice } from 'salvageunion-reference'

import { SheetInput } from '../../shared/SheetInput'
import { EntitySubheader } from './EntitySubheader'
import { EntityListDisplay } from './EntityListDisplay'
import { PreselectedEntityDisplay } from './PreselectedEntityDisplay'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { getParagraphString } from '../../../../shared/lib/contentBlockHelpers'
import { cn } from '../../../utils/cn'

type EntityChoiceProps = {
  choice: SURefObjectChoice
  userChoices?: Record<string, string> | null
  onChoiceSelection?: (choiceId: string, value: string | undefined) => void
}

export function EntityChoice({ choice, userChoices, onChoiceSelection }: EntityChoiceProps) {
  const { fontSize } = useEntityDisplayContext()
  const hasSchemaEntities = 'schemaEntities' in choice && choice.schemaEntities
  const hasCustomSystemOptions = 'customSystemOptions' in choice && choice.customSystemOptions
  const hasChoiceOptions = 'choiceOptions' in choice && choice.choiceOptions
  const hasSchema = 'schema' in choice && choice.schema && choice.schema.length > 0
  const selectedChoice = userChoices?.[choice.id]
  const isMultiSelect = 'multiSelect' in choice && choice.multiSelect === true

  const isSimpleChoice =
    !hasSchema && !hasSchemaEntities && !hasCustomSystemOptions && !hasChoiceOptions

  const isSchemaPageMode = onChoiceSelection === undefined
  const hasLimitedChoices = hasSchemaEntities || hasCustomSystemOptions || hasChoiceOptions
  const isSetIndexable = 'setIndexable' in choice && choice.setIndexable === true

  return (
    <div>
      {!isSimpleChoice && (
        <div className="mb-2 flex items-center gap-2">
          <EntitySubheader disabled={isSchemaPageMode} label={choice.name} />
          {hasLimitedChoices && !selectedChoice && !isSetIndexable && (
            <Text className={cn('text-su-black opacity-70', fontSize.sm)}>
              {isMultiSelect ? '(choose multiple)' : '(choose one)'}
            </Text>
          )}
        </div>
      )}

      {isSchemaPageMode &&
        userChoices &&
        hasSchema &&
        !hasSchemaEntities &&
        !hasCustomSystemOptions && (
          <PreselectedEntityDisplay choice={choice} selectedChoice={selectedChoice} />
        )}

      {(hasSchemaEntities || hasCustomSystemOptions || hasChoiceOptions) && (
        <EntityListDisplay
          choice={choice}
          selectedChoice={selectedChoice}
          userChoices={userChoices}
          onChoiceSelection={onChoiceSelection}
          isMultiSelect={isMultiSelect}
        />
      )}

      {isSimpleChoice && (
        <SheetInput
          label={choice.name}
          value={userChoices?.[choice.id] || ''}
          onChange={(value) => onChoiceSelection?.(choice.id, value)}
          placeholder={getParagraphString(choice.content) || 'Enter value...'}
          disabled={onChoiceSelection === undefined}
        />
      )}
    </div>
  )
}
