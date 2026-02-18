import type { SURefObjectChoice } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { SheetInput } from '../../shared/SheetInput'
import { EntitySubheader } from './EntitySubheader'
import { EntityListDisplay } from './EntityListDisplay'
import { getParagraphString } from '../../../lib/contentBlockHelpers'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes, getEntitySpacing } from './entityDisplayTypes'

type EntityChoiceProps = {
  choice: SURefObjectChoice
  fontSize: ReturnType<typeof getEntityFontSizes>
  spacing: ReturnType<typeof getEntitySpacing>
}

export function EntityChoice({ choice, fontSize, spacing }: EntityChoiceProps) {
  const hasSchemaEntities = 'schemaEntities' in choice && choice.schemaEntities
  const hasCustomSystemOptions = 'customSystemOptions' in choice && choice.customSystemOptions
  const hasChoiceOptions = 'choiceOptions' in choice && choice.choiceOptions
  const hasSchema = 'schema' in choice && choice.schema && choice.schema.length > 0
  const isMultiSelect = 'multiSelect' in choice && choice.multiSelect === true

  const isSimpleChoice =
    !hasSchema && !hasSchemaEntities && !hasCustomSystemOptions && !hasChoiceOptions

  const hasLimitedChoices = hasSchemaEntities || hasCustomSystemOptions || hasChoiceOptions
  const isSetIndexable = 'setIndexable' in choice && choice.setIndexable === true

  return (
    <div>
      {!isSimpleChoice && (
        <div className="mb-2 flex items-center gap-2">
          <EntitySubheader label={choice.name} headerFontSize={fontSize.lg} />
          {hasLimitedChoices && !isSetIndexable && (
            <Text className={cn('text-su-black opacity-70', fontSize.sm)}>
              {isMultiSelect ? '(choose multiple)' : '(choose one)'}
            </Text>
          )}
        </div>
      )}

      {(hasSchemaEntities || hasCustomSystemOptions || hasChoiceOptions) && (
        <EntityListDisplay choice={choice} isMultiSelect={isMultiSelect} spacing={spacing} />
      )}

      {isSimpleChoice && (
        <SheetInput
          label={choice.name}
          value=""
          placeholder={getParagraphString(choice.content) || 'Enter value...'}
          disabled
        />
      )}
    </div>
  )
}
