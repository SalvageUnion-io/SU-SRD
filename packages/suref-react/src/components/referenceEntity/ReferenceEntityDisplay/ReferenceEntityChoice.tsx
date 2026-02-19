import type { ReactNode } from 'react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { ReferenceEntitySubheader } from './ReferenceEntitySubheader'
import { ReferenceEntityListDisplay } from './ReferenceEntityListDisplay'
import { cn } from '../../../utils/cn'
import type {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from './referenceEntityDisplayTypes'

export type ChoiceInputRenderer = (choice: SURefObjectChoice, compact: boolean) => ReactNode

type ReferenceEntityChoiceProps = {
  choice: SURefObjectChoice
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
  choiceInputRenderer?: ChoiceInputRenderer
}

export function ReferenceEntityChoice({
  choice,
  fontSize,
  spacing,
  compact,
  choiceInputRenderer,
}: ReferenceEntityChoiceProps) {
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
          <ReferenceEntitySubheader label={choice.name} headerFontSize={fontSize.lg} />
          {hasLimitedChoices && !isSetIndexable && (
            <Text className={cn('text-su-black opacity-70', fontSize.sm)}>
              {isMultiSelect ? '(choose multiple)' : '(choose one)'}
            </Text>
          )}
        </div>
      )}

      {(hasSchemaEntities || hasCustomSystemOptions || hasChoiceOptions) && (
        <ReferenceEntityListDisplay
          choice={choice}
          isMultiSelect={isMultiSelect}
          spacing={spacing}
        />
      )}

      {isSimpleChoice && choiceInputRenderer && choiceInputRenderer(choice, compact ?? false)}
    </div>
  )
}
