import type { SURefEntity, SURefObjectDataValue } from 'salvageunion-reference'
import { getChoices, resolveChoiceView } from 'salvageunion-reference'
import { DataValueDisplayView } from '../DataValueDisplayView'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'

type ReferenceEntityResolvedDataRowProps = {
  data: SURefEntity
  /** Current choice selections — the row recomputes live as these change. */
  selections: ChoiceSelections
  compact?: boolean
}

/**
 * ReferenceEntityResolvedDataRow — the live resolved dataview tags for a
 * choice-bearing entity (e.g. the Custom Sniper Rifle): base `datavalues` +
 * applied choice effects, the resolved trait list, and a segmented "Choose: …"
 * tag for each unresolved choice. Rendered inside the header data row (the
 * subtitle) so the stats update live as choices are toggled in the body, while
 * the interactive choice cards live in the body below.
 *
 * Returns a fragment of `DataValueDisplayView` tags (no wrapper), so it slots
 * into the subtitle's flex row via `subtitleExtra`. Renders nothing when the
 * resolved view is empty.
 */
export function ReferenceEntityResolvedDataRow({
  data,
  selections,
  compact,
}: ReferenceEntityResolvedDataRowProps) {
  const view = resolveChoiceView(data, selections)
  const choices = getChoices(data) ?? []

  // Resolved traits render with the same chrome as the base datavalues.
  const traitRow: SURefObjectDataValue[] = view.traits.map((trait) => ({
    label: trait.type,
    value: trait.amount,
    type: 'trait',
  }))
  const rowItems = [...view.datavalues, ...traitRow]

  if (rowItems.length === 0 && view.prompts.length === 0) {
    return null
  }

  return (
    <>
      {rowItems.map((item, index) => {
        // A datavalue carrying a `unit` (e.g. Damage 2 SP) renders as a 3-segment
        // tag [LABEL][value][unit] via the segmented chrome — label + unit on
        // black, value on white — so the damage type shows after the number in
        // all rendering states.
        const unit = 'unit' in item ? item.unit : undefined
        if (unit && item.value !== undefined) {
          return (
            <DataValueDisplayView
              key={`dv-${index}`}
              item={{ label: item.label, value: `${item.value}||${unit}`, type: 'segmented' }}
              compact={compact}
            />
          )
        }
        return <DataValueDisplayView key={`dv-${index}`} item={item} compact={compact} />
      })}
      {view.prompts.map((prompt) => {
        // Unresolved choice → segmented chrome matching the class "X or Y Tree"
        // data row: [CHOOSE][opt][OR][opt], built from the choice's own options.
        const choice = choices.find((c) => c.id === prompt.choiceId)
        const options = choice?.schemaEntities ?? choice?.choiceOptions?.map((o) => o.label) ?? []
        return (
          <DataValueDisplayView
            key={prompt.choiceId}
            item={{ label: 'Choose', value: options.join('||OR||'), type: 'segmented' }}
            compact={compact}
          />
        )
      })}
    </>
  )
}
