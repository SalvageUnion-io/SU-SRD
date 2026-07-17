import { Text } from '../../base/Text'
import { Callout } from '../../chrome/Callout'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { accentTextColor, borderColorFromHeaderBg } from '../referenceEntityHelpers'

type StaticChoiceCardProps = {
  /** Whether to use compact styling. */
  compact?: boolean
  /** Parent entity header background class, for accent derivation. */
  parentHeaderBg?: string
  /** Raw CSS color for the parent accent (overrides parentHeaderBg). */
  parentHeaderBgColor?: string
  label?: string
  description?: string
}

/** The full parent-accent colour (falls back to faint when there is no accent). */
function choiceAccent(
  parentHeaderBg: string | undefined,
  parentHeaderBgColor: string | undefined
): string {
  return borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor) ?? 'var(--color-wk-faint)'
}

/**
 * StaticChoiceCard — the display-only frame `Content` uses to render `list-item`
 * content blocks (NPC motivations, "one of the following" options, the settlement
 * tech-level examples). A thin domain wrapper over the shared `Callout` primitive:
 * it derives the parent-entity accent + light tint, then hands the label + body to
 * `Callout`. No selectable status, toggle, or fade — display only.
 */
export function StaticChoiceCard({
  label,
  description,
  compact = false,
  parentHeaderBg,
  parentHeaderBgColor,
}: StaticChoiceCardProps) {
  const parsedDescription = useParseTraitReferences(description)
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)
  // The header band (labelled items only) gets a light tint of the accent.
  const headerBg = accentTextColor(parentHeaderBg, parentHeaderBgColor) ?? undefined

  return (
    <Callout label={label} accent={accent} headerBg={headerBg} compact={compact}>
      {description ? (
        // `variant="body"` so the text inherits the same content font as the
        // surrounding Content paragraphs (the default variant forces font-mono).
        <Text variant="body" as="span" className="block">
          {parsedDescription}
        </Text>
      ) : undefined}
    </Callout>
  )
}
