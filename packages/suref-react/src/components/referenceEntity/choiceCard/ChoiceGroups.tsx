import { useCallback, useState } from 'react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { ChoiceGroup } from './ChoiceGroup'
import {
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
  type ChoiceSelections,
} from './choiceSelectionHelpers'

type ChoiceGroupsProps = {
  /** The choices to render (e.g. entity.choices). */
  choices: SURefObjectChoice[]
  /**
   * The parent entity, used to resolve `scalesWithField` caps (e.g. techLevel).
   * Passed as a generic record so the component stays schema-agnostic.
   */
  parent?: Record<string, unknown>
  /**
   * Controlled selections, keyed by choice id. When provided alongside
   * `onSelectionChange`, the component is controlled; otherwise it self-manages
   * ephemeral React state (lost on refresh).
   */
  selections?: ChoiceSelections
  /** Called with the next selections map whenever a selection changes. */
  onSelectionChange?: (selections: ChoiceSelections) => void
  compact?: boolean
  parentHeaderBg?: string
  parentHeaderBgColor?: string
}

/**
 * ChoiceGroups — the interactive choice renderer for granted equipment.
 *
 * Renders one ChoiceGroup per choice (option groups + free-text groups), owning
 * the selection state. Controlled via `selections` + `onSelectionChange`; with
 * neither passed it self-manages ephemeral state (the suref-web case — no
 * persistence, lost on refresh). This keeps suref-react data-source agnostic;
 * ITUN wires the controlled props to its persistence stores.
 *
 * Selection rules (delegated to choiceSelectionHelpers):
 * - Exclusive choice (multiSelect false): selecting one deselects the others.
 * - Multi-select with a resolved cap (constraints.scalesWithField / max): at the
 *   cap, remaining option cards are disabled (no silent replacement).
 */
export function ChoiceGroups({
  choices,
  parent,
  selections: controlledSelections,
  onSelectionChange,
  compact,
  parentHeaderBg,
  parentHeaderBgColor,
}: ChoiceGroupsProps) {
  const isControlled = controlledSelections !== undefined
  const [internalSelections, setInternalSelections] = useState<ChoiceSelections>({})

  const selections = isControlled ? controlledSelections : internalSelections

  const commit = useCallback(
    (next: ChoiceSelections) => {
      if (!isControlled) {
        setInternalSelections(next)
      }
      onSelectionChange?.(next)
    },
    [isControlled, onSelectionChange]
  )

  const handleToggleOption = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      const current = selections[choice.id] ?? []
      const multiSelect = isMultiSelectChoice(choice)
      // The SRD shows the inherent cap as an informational `n/max` counter but
      // lets the user select beyond it (no cap passed to toggleSelection). ITUN
      // can enforce the cap later via its persistence layer.
      const nextForChoice = toggleSelection(current, value, multiSelect)
      commit({ ...selections, [choice.id]: nextForChoice })
    },
    [selections, commit]
  )

  const handleFreeTextChange = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      commit({ ...selections, [choice.id]: value.length > 0 ? [value] : [] })
    },
    [selections, commit]
  )

  if (choices.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {choices.map((choice) => (
        <ChoiceGroup
          key={choice.id}
          choice={choice}
          selected={selections[choice.id] ?? []}
          cap={resolveMultiSelectCap(choice, parent)}
          onToggleOption={(value) => handleToggleOption(choice, value)}
          onFreeTextChange={(value) => handleFreeTextChange(choice, value)}
          compact={compact}
          parentHeaderBg={parentHeaderBg}
          parentHeaderBgColor={parentHeaderBgColor}
        />
      ))}
    </div>
  )
}
