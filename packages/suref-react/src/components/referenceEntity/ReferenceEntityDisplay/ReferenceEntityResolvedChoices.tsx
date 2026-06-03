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
  /**
   * Optional scaling parent for `constraints.scalesWithField` caps (e.g. the
   * Modification choice scaling with `techLevel`). A consumer with a play/build
   * context (ITUN) passes e.g. `{ techLevel: effectiveCrawlerLevel }` so the cap
   * resolves and the `n/max` counter + at-cap disabling engage.
   *
   * SRD passes nothing — caps stay unbounded, behaviour is unchanged. Additive
   * optional prop.
   */
  scalingParent?: Record<string, unknown>
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
  scalingParent,
}: ReferenceEntityResolvedChoicesProps) {
  const choices = getChoices(data) ?? []

  if (choices.length === 0 || hideChoices) {
    return null
  }

  return (
    // `scalesWithField` caps (e.g. Modification "at each Tech Level") scale with a
    // play/build context — the crawler or character — which the read-only SRD
    // reference doesn't have, so it passes no `scalingParent` and those caps stay
    // unbounded (any intrinsic `constraints.max` still applies). A build context
    // (ITUN) passes `scalingParent` (e.g. `{ techLevel }`) so the cap resolves.
    // This keeps the behavior generic — no per-entity callouts.
    <ChoiceGroups
      choices={choices}
      parent={scalingParent}
      selections={selections}
      onSelectionChange={onSelectionChange}
      compact={compact}
      parentHeaderBg={parentHeaderBg}
      parentHeaderBgColor={parentHeaderBgColor}
    />
  )
}
