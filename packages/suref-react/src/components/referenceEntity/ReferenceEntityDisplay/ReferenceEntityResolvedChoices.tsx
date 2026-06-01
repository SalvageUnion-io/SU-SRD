import { useState } from 'react'
import type { SURefEntity, SURefObjectDataValue } from 'salvageunion-reference'
import { getChoices, resolveChoiceView } from 'salvageunion-reference'
import { DataValueDisplayView } from '../DataValueDisplayView'
import { ChoiceGroups } from '../choiceCard/ChoiceGroups'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityResolvedChoicesProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact?: boolean
  hideChoices?: boolean
  /** Parent header colors so the choice cards match the entity accent. */
  parentHeaderBg?: string
  parentHeaderBgColor?: string
  /**
   * Controlled selections (ITUN persistence). With neither this nor
   * `onSelectionChange`, the component self-manages ephemeral React state
   * (suref-web: lost on refresh).
   */
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
}

/**
 * ReferenceEntityResolvedChoices — the live, interactive dataview for an entity
 * that carries choices (granted equipment such as the Custom Sniper Rifle).
 *
 * It renders:
 *  1. the RESOLVED dataview row — base `datavalues` + applied choice effects
 *     (setRange / addDamage), the resolved trait list, and a `Choose: …` prompt
 *     for any unresolved required choice — via `DataValueDisplayView`; and
 *  2. the interactive choice-group cards (`ChoiceGroups`) below it.
 *
 * The row recomputes live on every selection toggle via `resolveChoiceView`,
 * the shared resolver in `salvageunion-reference`. Selections are ephemeral by
 * default (self-managed) and controlled when `selections` + `onSelectionChange`
 * are supplied. This replaces the old static `ReferenceEntityChoices` UI.
 */
export function ReferenceEntityResolvedChoices({
  data,
  spacing,
  compact,
  hideChoices,
  parentHeaderBg,
  parentHeaderBgColor,
  selections: controlledSelections,
  onSelectionChange,
}: ReferenceEntityResolvedChoicesProps) {
  const choices = getChoices(data) ?? []
  const isControlled = controlledSelections !== undefined
  const [internalSelections, setInternalSelections] = useState<ChoiceSelections>({})
  const selections = isControlled ? controlledSelections : internalSelections

  if (choices.length === 0 || hideChoices) {
    return null
  }

  const handleSelectionChange = (next: ChoiceSelections) => {
    if (!isControlled) {
      setInternalSelections(next)
    }
    onSelectionChange?.(next)
  }

  const view = resolveChoiceView(data, selections)

  // Surface the resolved traits in the data row as trait-type values so they
  // render with the same chrome as the base datavalues (Ballistic / Energy /
  // Anti-Organic …). Traits carry `{ type, amount? }`; map to a DataValue.
  const traitRow: SURefObjectDataValue[] = view.traits.map((trait) => ({
    label: trait.type,
    value: trait.amount,
    type: 'trait',
  }))

  const rowItems = [...view.datavalues, ...traitRow]
  const hasRow = rowItems.length > 0 || view.prompts.length > 0

  return (
    <div className={cn('flex flex-col', spacing.sectionSpaceYClass)}>
      {hasRow && (
        <div className="flex flex-row flex-wrap items-center gap-1">
          {rowItems.map((item, index) => (
            <DataValueDisplayView key={index} item={item} compact={compact} />
          ))}
          {view.prompts.map((prompt) => (
            <span
              key={prompt.choiceId}
              className="inline-flex shrink-0 items-center border border-dashed border-su-rust px-2 py-0.5"
            >
              <Text
                variant="pseudoheader"
                as="span"
                className={cn('uppercase text-su-rust', compact ? 'text-xs' : 'text-sm')}
              >
                {prompt.text}
              </Text>
            </span>
          ))}
        </div>
      )}
      <ChoiceGroups
        choices={choices}
        parent={data as unknown as Record<string, unknown>}
        // Always pass controlled props: this component owns the selection state
        // (ephemeral by default, lifted from the caller when controlled) so it
        // can recompute the resolved row live on every toggle.
        selections={selections}
        onSelectionChange={handleSelectionChange}
        compact={compact}
        parentHeaderBg={parentHeaderBg}
        parentHeaderBgColor={parentHeaderBgColor}
      />
    </div>
  )
}
