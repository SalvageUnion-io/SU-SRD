import type { SURefEntity, SURefObjectChoice } from 'salvageunion-reference'
import { getChoices } from 'salvageunion-reference'
import { ReferenceEntityChoice } from './ReferenceEntityChoice'
import type { ChoiceInputRenderer } from './ReferenceEntityChoice'
import { cn } from '../../../utils/cn'
import type {
  getReferenceEntitySpacing,
  getReferenceEntityFontSizes,
} from './referenceEntityDisplayTypes'

export type ReferenceEntityChoicesProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  hideChoices: boolean
  compact?: boolean
  choiceInputRenderer?: ChoiceInputRenderer
}

export function ReferenceEntityChoices({
  data,
  spacing,
  fontSize,
  hideChoices,
  compact,
  choiceInputRenderer,
}: ReferenceEntityChoicesProps) {
  const entityChoices: SURefObjectChoice[] = getChoices(data) || []

  if (entityChoices.length === 0 || hideChoices) {
    return null
  }

  return (
    <div className={cn(spacing.smallSpaceYClass)}>
      {entityChoices.map((choice) => (
        <ReferenceEntityChoice
          key={choice.id}
          choice={choice}
          fontSize={fontSize}
          spacing={spacing}
          compact={compact}
          choiceInputRenderer={choiceInputRenderer}
        />
      ))}
    </div>
  )
}
