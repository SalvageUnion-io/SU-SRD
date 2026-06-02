import type { ChangeEvent, ReactNode } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { CalloutMetaStamp } from '../ReferenceEntityDisplay/components/CalloutMetaStamp'
import { accentTextColor, borderColorFromHeaderBg } from '../referenceEntityHelpers'

type ChoiceCardShellProps = {
  /** Whether to use compact styling. */
  compact?: boolean
  /** Parent entity header background class, for accent derivation. */
  parentHeaderBg?: string
  /** Raw CSS color for the parent accent (overrides parentHeaderBg). */
  parentHeaderBgColor?: string
}

/** The full parent-accent colour (falls back to grey when there is no accent). */
function choiceAccent(
  parentHeaderBg: string | undefined,
  parentHeaderBgColor: string | undefined
): string {
  return (
    borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor) ?? 'var(--color-su-grey-light)'
  )
}

/**
 * The choice card's coloured header/frame: a unique, lighter accent tint when not
 * chosen; the full parent-accent colour (the entity card's colour) once chosen.
 * The border is always the full accent.
 */
function choiceCardColors(
  chosen: boolean,
  parentHeaderBg: string | undefined,
  parentHeaderBgColor: string | undefined
): { backgroundColor: string; borderColor: string } {
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)
  const light = accentTextColor(parentHeaderBg, parentHeaderBgColor) ?? 'var(--color-su-white)'
  return {
    backgroundColor: chosen ? accent : light,
    borderColor: accent,
  }
}

/**
 * The Chosen / Not Chosen stamp, straddling the card's top edge in the callout
 * row — the same place the entity card's View Details control sits.
 */
function ChoiceStatusCallout({ chosen, compact }: { chosen: boolean; compact: boolean }) {
  return (
    <span className="absolute top-0 right-0 z-20 mr-1.5 -translate-y-1/2">
      <CalloutMetaStamp rust={chosen} compact={compact}>
        {chosen ? 'Chosen' : 'Not Chosen'}
      </CalloutMetaStamp>
    </span>
  )
}

/** The black-stamp title sitting on the card's coloured header — matching the
 *  entity card's pseudoheader title. Faded until the option is chosen. */
function ChoiceCardHeader({
  label,
  chosen,
  compact,
}: {
  label: string
  chosen: boolean
  compact: boolean
}) {
  return (
    <div className={cn(compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
      <Text
        variant="pseudoheader"
        as="span"
        className={cn('w-fit', compact ? 'text-sm' : 'text-base', !chosen && 'opacity-50')}
      >
        {label}
      </Text>
    </div>
  )
}

/** The white inset content box (description, fields) with a 3px accent left
 *  border, matching ActionCard / entity-card bodies. */
function ChoiceCardBody({
  accent,
  compact,
  topGap,
  children,
}: {
  accent: string
  compact: boolean
  /** Add a top margin so the coloured frame shows above the box (headerless cards). */
  topGap?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'min-w-0 border-l-[3px] bg-su-white',
        compact ? 'mx-1.5 mb-1.5 px-2 py-1' : 'mx-2 mb-2 px-3 py-2',
        topGap && (compact ? 'mt-1.5' : 'mt-2')
      )}
      style={{ borderLeftColor: accent }}
    >
      {children}
    </div>
  )
}

type ChoiceOptionCardProps = ChoiceCardShellProps & {
  label: string
  description?: string
  /** Whether this card reads as chosen (full accent fill + rust stamp). */
  chosen: boolean
  /** Whether the card is disabled. */
  disabled?: boolean
  /** Toggle handler; omitted/disabled cards are non-interactive. */
  onToggle?: () => void
}

/**
 * ChoiceCard (option variant) — a single selectable option matching the entity
 * card / nested-action chrome: a coloured header (lighter accent tint when not
 * chosen, full accent colour when chosen) carrying the black-stamp title, over a
 * white inset body for the description, with the Chosen / Not Chosen status in
 * the callout row straddling the top edge. Clickable to toggle unless disabled.
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
  const parsedDescription = useParseTraitReferences(description)
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const interactive = !disabled && onToggle !== undefined
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)

  return (
    <button
      type="button"
      onClick={interactive ? onToggle : undefined}
      disabled={disabled}
      aria-pressed={chosen}
      className={cn(
        'relative block w-full min-w-0 overflow-visible rounded-[3px] border text-left',
        interactive ? 'cursor-pointer transition-colors' : 'cursor-default',
        disabled && 'opacity-50'
      )}
      style={choiceCardColors(chosen, parentHeaderBg, parentHeaderBgColor)}
    >
      <ChoiceStatusCallout chosen={chosen} compact={compact} />
      <ChoiceCardHeader label={label} chosen={chosen} compact={compact} />
      {description && (
        <ChoiceCardBody accent={accent} compact={compact}>
          <Text as="span" className={cn('block text-su-black', fontSize, !chosen && 'opacity-80')}>
            {parsedDescription}
          </Text>
        </ChoiceCardBody>
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
 * ChoiceCard (free-text variant) — the same coloured header + white inset body,
 * wrapping an editable field (Name / Appearance / A.I. Personality). Reads as
 * chosen once the field is non-empty, surfacing the same callout-row status.
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
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)
  // The prompt becomes the field's placeholder — these are inputs, not text
  // description fields.
  const effectivePlaceholder = placeholder ?? description

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onValueChange?.(event.target.value)
  }

  const fieldClasses = cn(
    'w-full border border-su-black/20 bg-su-white text-su-black',
    'focus:border-su-rust focus:outline-none',
    compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
  )

  // Input cards are always "active" — full accent fill + full title, no
  // Chosen / Not Chosen status.
  return (
    <div
      className={cn('relative w-full min-w-0 overflow-hidden rounded-[3px] border')}
      style={choiceCardColors(true, parentHeaderBg, parentHeaderBgColor)}
    >
      <ChoiceCardHeader label={label} chosen compact={compact} />
      <ChoiceCardBody accent={accent} compact={compact}>
        {multiline ? (
          <textarea
            aria-label={label}
            className={fieldClasses}
            value={value}
            placeholder={effectivePlaceholder}
            rows={compact ? 2 : 3}
            onChange={handleChange}
          />
        ) : (
          <input
            type="text"
            aria-label={label}
            className={fieldClasses}
            value={value}
            placeholder={effectivePlaceholder}
            onChange={handleChange}
          />
        )}
      </ChoiceCardBody>
    </div>
  )
}

type StaticChoiceCardProps = ChoiceCardShellProps & {
  label?: string
  description?: string
}

/**
 * StaticChoiceCard — the choice-card chrome for display-only list items (e.g. NPC
 * motivations, "scour the wastelands for one of the following" options): a
 * coloured frame over a white inset body. With a `label` it leads with the
 * black-stamp title header; without one (unlabelled bullets) it's just the framed
 * white body. No selectable status, toggle, or fade — it just borrows the look.
 */
export function StaticChoiceCard({
  label,
  description,
  compact = false,
  parentHeaderBg,
  parentHeaderBgColor,
}: StaticChoiceCardProps) {
  const parsedDescription = useParseTraitReferences(description)
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden rounded-[3px] border"
      style={choiceCardColors(false, parentHeaderBg, parentHeaderBgColor)}
    >
      {label && <ChoiceCardHeader label={label} chosen compact={compact} />}
      {description && (
        <ChoiceCardBody accent={accent} compact={compact} topGap={!label}>
          <Text as="span" className={cn('block text-su-black', fontSize)}>
            {parsedDescription}
          </Text>
        </ChoiceCardBody>
      )}
    </div>
  )
}
