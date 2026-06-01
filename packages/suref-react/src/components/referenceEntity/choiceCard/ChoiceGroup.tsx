import type { SURefObjectChoice } from 'salvageunion-reference'
import { parseContentBlockString } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { SectionSeparator } from '../ReferenceEntityDisplay/SectionSeparator'
import { ChoiceCard, FreeTextChoiceCard } from './ChoiceCard'
import {
  getChoiceCardOptions,
  isFreeTextChoice,
  isMultiSelectChoice,
} from './choiceSelectionHelpers'

type ChoiceGroupProps = {
  choice: SURefObjectChoice
  /** Selected option values for this choice. */
  selected: string[]
  /** Toggle an option value (option choices). */
  onToggleOption: (value: string) => void
  /** Set the free-text value (free-text choices). */
  onFreeTextChange: (value: string) => void
  /** Resolved multi-select cap, when one applies. */
  cap?: number
  compact?: boolean
  parentHeaderBg?: string
  parentHeaderBgColor?: string
}

/**
 * Renders a single choice group: a SectionSeparator-styled header (the choice
 * name, e.g. WEAPON TYPE / MODIFICATION) carrying a `(n/max)` counter for capped
 * multi-select groups, followed by the option cards — or, for free-text
 * choices, a single editable free-text card.
 *
 * At the multi-select cap, unselected option cards are disabled (no silent
 * replacement) until one is deselected.
 */
export function ChoiceGroup({
  choice,
  selected,
  onToggleOption,
  onFreeTextChange,
  cap,
  compact,
  parentHeaderBg,
  parentHeaderBgColor,
}: ChoiceGroupProps) {
  const multiSelect = isMultiSelectChoice(choice)
  const freeText = isFreeTextChoice(choice)

  const counter = multiSelect && typeof cap === 'number' ? `${selected.length}/${cap}` : undefined

  const atCap = typeof cap === 'number' && selected.length >= cap

  if (freeText) {
    const promptBlock = choice.content?.find((block) => block.type === 'paragraph')
    const description = promptBlock ? parseContentBlockString(promptBlock) : undefined
    const currentValue = selected[0] ?? ''
    return (
      <div className={cn('flex flex-col gap-2')}>
        <SectionSeparator label={choice.name} compact={compact} />
        <FreeTextChoiceCard
          label={choice.name}
          description={description}
          value={currentValue}
          onValueChange={onFreeTextChange}
          multiline={choice.name.toLowerCase() !== 'name'}
          compact={compact}
          parentHeaderBg={parentHeaderBg}
          parentHeaderBgColor={parentHeaderBgColor}
        />
      </div>
    )
  }

  const options = getChoiceCardOptions(choice)

  return (
    <div className={cn('flex flex-col gap-2')}>
      <SectionSeparator label={choice.name} value={counter} compact={compact} />
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChosen = selected.includes(option.value)
          const disabled = multiSelect && atCap && !isChosen
          return (
            <ChoiceCard
              key={option.value}
              label={option.label}
              description={option.description}
              chosen={isChosen}
              disabled={disabled}
              compact={compact}
              parentHeaderBg={parentHeaderBg}
              parentHeaderBgColor={parentHeaderBgColor}
              onToggle={() => onToggleOption(option.value)}
            />
          )
        })}
      </div>
    </div>
  )
}
