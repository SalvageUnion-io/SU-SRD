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
 * The cap is shown as an informational `n/max` counter; the SRD lets the user
 * select beyond it (no hard disable), so `n` may exceed `max`.
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

  if (freeText) {
    const promptBlock = choice.content?.find((block) => block.type === 'paragraph')
    const description = promptBlock ? parseContentBlockString(promptBlock) : undefined
    const currentValue = selected[0] ?? ''
    // No SectionSeparator — the input card's own header already shows the name.
    return (
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
    )
  }

  const options = getChoiceCardOptions(choice)

  return (
    <div className={cn('flex flex-col gap-2')}>
      <SectionSeparator
        label={choice.name}
        value={counter}
        compact={compact}
        fontSize={compact ? 'text-xs' : 'text-sm'}
      />
      {/* Masonry: up to 3 columns, dropping to 2 then 1 as the container narrows
          (@container queries). `break-inside-avoid` keeps each card whole. The
          `pt-3` / `mb-4` leave room for each card's Chosen/Not callout stamp,
          which straddles ~half its height above the card's top edge. */}
      <div className="@container">
        <div className="columns-1 gap-2 pt-3 @md:columns-2 @4xl:columns-3">
          {options.map((option) => (
            <div key={option.value} className="mb-4 break-inside-avoid">
              <ChoiceCard
                label={option.label}
                description={option.description}
                chosen={selected.includes(option.value)}
                compact={compact}
                parentHeaderBg={parentHeaderBg}
                parentHeaderBgColor={parentHeaderBgColor}
                onToggle={() => onToggleOption(option.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
