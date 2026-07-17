import type { ReactNode } from 'react'
import { Badge } from '../../chrome/Badge'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
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
  return borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor) ?? 'var(--color-wk-faint)'
}

/** Coloured frame colours: light tint body + full-accent border. */
function choiceCardColors(
  parentHeaderBg: string | undefined,
  parentHeaderBgColor: string | undefined
): { backgroundColor: string; borderColor: string } {
  const accent = choiceAccent(parentHeaderBg, parentHeaderBgColor)
  const light = accentTextColor(parentHeaderBg, parentHeaderBgColor) ?? 'var(--color-paper)'
  return { backgroundColor: light, borderColor: accent }
}

/** The black-stamp title on the coloured header — the canonical Badge stamp atom. */
function StaticChoiceCardHeader({ label, compact }: { label: string; compact: boolean }) {
  return (
    <div className={cn(compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
      <Badge shape="stamp" size={compact ? 'sm' : 'md'}>
        {label}
      </Badge>
    </div>
  )
}

/** The white inset content box with a 3px accent left border. */
function StaticChoiceCardBody({
  accent,
  compact,
  topGap,
  children,
}: {
  accent: string
  compact: boolean
  topGap?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'min-w-0 border-l-[3px] bg-paper',
        compact ? 'mx-1.5 mb-1.5 px-2 py-1' : 'mx-2 mb-2 px-3 py-2',
        topGap && (compact ? 'mt-1.5' : 'mt-2')
      )}
      style={{ borderLeftColor: accent }}
    >
      {children}
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
 *
 * Display-only remnant of the retired interactive ChoiceCard; used by
 * `Content` to render `list-item` content blocks.
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
      className="relative w-full min-w-0 overflow-hidden rounded-card border"
      style={choiceCardColors(parentHeaderBg, parentHeaderBgColor)}
    >
      {label && <StaticChoiceCardHeader label={label} compact={compact} />}
      {description && (
        <StaticChoiceCardBody accent={accent} compact={compact} topGap={!label}>
          <Text as="span" className={cn('block text-ink', fontSize)}>
            {parsedDescription}
          </Text>
        </StaticChoiceCardBody>
      )}
    </div>
  )
}
