import type { ChangeEvent } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { CalloutMetaStamp } from '../ReferenceEntityDisplay/components/CalloutMetaStamp'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'

type ChoiceCardShellProps = {
  /** Whether to use compact styling. */
  compact?: boolean
  /** Parent entity header background class, for accent-border derivation. */
  parentHeaderBg?: string
  /** Raw CSS color for the parent accent (overrides parentHeaderBg). */
  parentHeaderBgColor?: string
}

/**
 * Inset white body box matching ActionCard's body treatment: a 3px left accent
 * border in the parent accent colour. Shared by the option and free-text cards.
 */
function cardBoxClasses(chosen: boolean, disabled: boolean, compact: boolean): string {
  return cn(
    'w-full min-w-0 bg-su-white border-l-[3px]',
    compact ? 'px-2 py-1' : 'px-3 py-2',
    chosen ? 'border border-su-rust' : 'border border-su-grey-light',
    disabled && 'opacity-50'
  )
}

type ChoiceOptionCardProps = ChoiceCardShellProps & {
  label: string
  description?: string
  /** Whether this card reads as chosen (rust stamp + accent border). */
  chosen: boolean
  /** Whether the card is disabled (e.g. multi-select at cap, not selected). */
  disabled?: boolean
  /** Toggle handler; omitted/disabled cards are non-interactive. */
  onToggle?: () => void
}

/**
 * ChoiceCard (option variant) — a single selectable option rendered as a card
 * matching the nested-action body style. Shows the option label, its
 * description (the human-readable mechanic, kept as the body), and a
 * CalloutMetaStamp status (rust = Chosen, neutral = Not Chosen). Clickable to
 * toggle unless disabled.
 */
export function ChoiceCard({
  label,
  description,
  chosen,
  disabled = false,
  compact = false,
  parentHeaderBg,
  parentHeaderBgColor,
  onToggle,
}: ChoiceOptionCardProps) {
  const accentBorder = chosen
    ? 'var(--color-su-rust)'
    : borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor)
  const parsedDescription = useParseTraitReferences(description)
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const interactive = !disabled && onToggle !== undefined

  return (
    <button
      type="button"
      onClick={interactive ? onToggle : undefined}
      disabled={disabled}
      aria-pressed={chosen}
      className={cn(
        'block text-left',
        cardBoxClasses(chosen, disabled, compact),
        interactive && 'cursor-pointer hover:bg-su-grey-lightest',
        !interactive && 'cursor-default'
      )}
      style={accentBorder ? { borderLeftColor: accentBorder } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <Text as="span" className={cn('font-bold', compact ? 'text-sm' : 'text-base')}>
          {label}
        </Text>
        <CalloutMetaStamp rust={chosen} compact={compact}>
          {chosen ? 'Chosen' : 'Not Chosen'}
        </CalloutMetaStamp>
      </div>
      {description && (
        <Text as="span" className={cn('mt-1 block text-su-black opacity-80', fontSize)}>
          {parsedDescription}
        </Text>
      )}
    </button>
  )
}

type FreeTextChoiceCardProps = ChoiceCardShellProps & {
  /** Choice label (Name, Appearance, A.I. Personality). */
  label: string
  /** Optional prompt/description shown above the field. */
  description?: string
  /** Current field value. */
  value: string
  /** Change handler for the field. */
  onValueChange?: (value: string) => void
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean
  /** Placeholder text for the field. */
  placeholder?: string
}

/**
 * ChoiceCard (free-text variant) — the same card shell wrapping an editable
 * field (Name / Appearance / A.I. Personality). Reads as chosen once the field
 * is non-empty, surfacing the same CalloutMetaStamp status.
 */
export function FreeTextChoiceCard({
  label,
  description,
  value,
  onValueChange,
  multiline = false,
  placeholder,
  compact = false,
  parentHeaderBg,
  parentHeaderBgColor,
}: FreeTextChoiceCardProps) {
  const chosen = value.trim().length > 0
  const accentBorder = chosen
    ? 'var(--color-su-rust)'
    : borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor)
  const parsedDescription = useParseTraitReferences(description)
  const fontSize = compact ? 'text-xs' : 'text-sm'

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onValueChange?.(event.target.value)
  }

  const fieldClasses = cn(
    'mt-1 w-full border border-su-grey-light bg-su-white text-su-black',
    'focus:border-su-rust focus:outline-none',
    compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
  )

  return (
    <div
      className={cardBoxClasses(chosen, false, compact)}
      style={accentBorder ? { borderLeftColor: accentBorder } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <Text as="span" className={cn('font-bold', compact ? 'text-sm' : 'text-base')}>
          {label}
        </Text>
        <CalloutMetaStamp rust={chosen} compact={compact}>
          {chosen ? 'Chosen' : 'Not Chosen'}
        </CalloutMetaStamp>
      </div>
      {description && (
        <Text as="span" className={cn('mt-1 block text-su-black opacity-80', fontSize)}>
          {parsedDescription}
        </Text>
      )}
      {multiline ? (
        <textarea
          aria-label={label}
          className={fieldClasses}
          value={value}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          onChange={handleChange}
        />
      ) : (
        <input
          type="text"
          aria-label={label}
          className={fieldClasses}
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
        />
      )}
    </div>
  )
}
