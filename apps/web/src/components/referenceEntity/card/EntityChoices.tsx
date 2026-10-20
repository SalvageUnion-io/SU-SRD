import type { RefMetaEntity, RefObjectChoice } from 'salvageunion-reference'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { ChoiceRegion } from './ChoiceRegion'
import { ReferenceEntityCard } from './ReferenceEntityCard'

/**
 * An entity's CHOICES, for a host that draws the entity as a contentful Token
 * rather than a Card (a crawler bay on a live sheet): each choice the Card's
 * own `ChoiceRegion`, on the lines under the Token in its `TokenGroup`, never
 * inside it (E6). Editable (`onSelectionChange`), every choice shows, its
 * options the toggles; read-only, only a choice that has been made does (an
 * unmade pick is a write cue, board 10). Nothing when there is none to show.
 */
export function EntityChoices({
  entity,
  selections,
  onSelectionChange,
  techLevel,
}: {
  entity: RefMetaEntity
  selections: ChoiceSelections | undefined
  onSelectionChange: ((selections: ChoiceSelections) => void) | undefined
  /** The host's tech level, which caps a catalog pick (a crawler's for its bay). */
  techLevel: number | undefined
}) {
  const choices: RefObjectChoice[] =
    'choices' in entity && Array.isArray(entity.choices) ? entity.choices : []
  const shown = onSelectionChange
    ? choices
    : choices.filter((choice) => (selections?.[choice.id]?.length ?? 0) > 0)
  if (shown.length === 0) return null
  return (
    <>
      {shown.map((choice) => (
        <ChoiceRegion
          key={choice.id}
          choice={choice}
          effTechLevel={techLevel}
          scalingParent={undefined}
          selections={selections}
          onSelectionChange={onSelectionChange}
          compact
          toneColor={undefined}
          depth={1}
          onPage={false}
          chassisName={undefined}
          NestedCard={ReferenceEntityCard}
        />
      ))}
    </>
  )
}
