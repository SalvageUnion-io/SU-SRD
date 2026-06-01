import type { SURefEntity } from 'salvageunion-reference'
import { getChoices } from 'salvageunion-reference'
import { ChoiceGroups } from '../choiceCard/ChoiceGroups'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'

type ReferenceEntityResolvedChoicesProps = {
  data: SURefEntity
  hideChoices?: boolean
  compact?: boolean
  /** Parent header colors so the choice cards match the entity accent. */
  parentHeaderBg?: string
  parentHeaderBgColor?: string
  /**
   * Controlled selections + change handler, owned by the parent display so the
   * header data row (`ReferenceEntityResolvedDataRow`) and these cards stay in
   * sync — toggling a card recomputes the header row live.
   */
  selections: ChoiceSelections
  onSelectionChange: (selections: ChoiceSelections) => void
}

/**
 * ReferenceEntityResolvedChoices — the interactive choice cards for an entity
 * that carries choices (granted equipment such as the Custom Sniper Rifle).
 *
 * The resolved dataview row now renders in the header (see
 * `ReferenceEntityResolvedDataRow`); this component renders only the choice-group
 * cards in the body. Selection state is owned by the parent and threaded through
 * `selections` + `onSelectionChange` so both surfaces share one source of truth.
 */
export function ReferenceEntityResolvedChoices({
  data,
  hideChoices,
  compact,
  parentHeaderBg,
  parentHeaderBgColor,
  selections,
  onSelectionChange,
}: ReferenceEntityResolvedChoicesProps) {
  const choices = getChoices(data) ?? []

  if (choices.length === 0 || hideChoices) {
    return null
  }

  return (
    <ChoiceGroups
      choices={choices}
      parent={data as unknown as Record<string, unknown>}
      selections={selections}
      onSelectionChange={onSelectionChange}
      compact={compact}
      parentHeaderBg={parentHeaderBg}
      parentHeaderBgColor={parentHeaderBgColor}
    />
  )
}
