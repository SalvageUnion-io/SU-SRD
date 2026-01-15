import type { SURefObjectChoice } from 'salvageunion-reference'
import { EntityChoiceDisplay } from '../shared/EntityChoiceDisplay'

export function SheetEntityChoiceDisplay({
  choice,
  onUpdateChoice,
  entityId,
}: {
  choice: SURefObjectChoice
  onUpdateChoice?: (choiceId: string, value: string | undefined) => void
  entityId: string | undefined
}) {
  return (
    <EntityChoiceDisplay
      mode="entity"
      choice={choice}
      entityId={entityId}
      onUpdateChoice={onUpdateChoice}
    />
  )
}
