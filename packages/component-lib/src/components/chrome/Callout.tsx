import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import type { SizeRung } from '../../styles/sizing'
import { Card } from '../shared/Card'
import { Badge } from './Badge'

/**
 * Callout accents — the closed set (ruleset §4.1: colour lives in tokens, not
 * call sites). Entity tones frame entity-flavoured notes; `bad` is the
 * "When Damaged" accent; `ink` is the neutral note.
 */
export type CalloutTone = 'ink' | 'pilot' | 'mech' | 'crawler' | 'bad'

const CALLOUT_ACCENT: Record<CalloutTone, string> = {
  ink: 'var(--color-ink)',
  pilot: 'var(--color-sheet-pilot)',
  mech: 'var(--color-sheet-mech)',
  crawler: 'var(--color-sheet-crawler)',
  bad: 'var(--color-status-bad)',
}

/** The header band is always a pale tint of the accent — one formula, no knob. */
function bandTint(tone: CalloutTone): string {
  return `color-mix(in srgb, ${CALLOUT_ACCENT[tone]} 12%, var(--color-paper))`
}

type CalloutProps = {
  /** Optional stamp header — rendered through the canonical Badge stamp atom. */
  label?: string
  /** Accent tone — the 3px solid frame, and (with a label) the band tint. */
  tone?: CalloutTone
  /**
   * Size on the canonical rung ladder (`src/styles/sizing.ts`) — two rungs:
   * `full` (default) is the reading note; `compact` tightens the band, body
   * padding and type for dense listings / nested content.
   */
  size?: Extract<SizeRung, 'full' | 'compact'>
  /** Body content — a paper panel under the header. */
  children?: ReactNode
  className?: string
}

/**
 * Callout — the accent-framed note in the "When Damaged" style: a 3px solid
 * accent border around an optional colour-banded stamp header and a paper body.
 * The one shape behind list-item content blocks (NPC motivations, "one of the
 * following" options, the settlement examples) and crawler-bay "When Damaged"
 * effects. Content-agnostic (a Container, not an Atom).
 *
 * The accent is a closed `tone` set, never a raw CSS colour — the band tint is
 * derived from the tone (a 12% paper mix), so a callout cannot drift off the
 * colour system one prop at a time.
 *
 * Composed on `Card` — it is a card (frame, optional header band, paper
 * body) and was the last card-shaped thing hand-rolling its own div stack. Two
 * Card capabilities exist because this component needs them, and both
 * are generally right: an omitted `headerContent` paints NO band (a label-less
 * callout is just a framed paper panel), and an explicit `borderColor` wins
 * over the header-derived default (the accent frame is deliberately a different
 * colour from the header tint).
 */
export function Callout({ label, tone = 'ink', size = 'full', children, className }: CalloutProps) {
  const compact = size === 'compact'
  return (
    <Card
      size={compact ? 'medium' : 'large'}
      borderColor={CALLOUT_ACCENT[tone]}
      headerBgColor={label ? bandTint(tone) : undefined}
      headerContent={
        label ? (
          <Badge shape="stamp" size={compact ? 'mini' : 'compact'}>
            {label}
          </Badge>
        ) : undefined
      }
      // The callout band is tighter than a card header and has no min-height —
      // it sizes to the stamp riding in it.
      headerStyle={{ className: cn('min-h-0', compact ? 'px-2 py-1' : 'px-3 py-1.5') }}
      bodyPadding={cn('leading-snug text-ink', compact ? 'p-2 text-xs' : 'p-3 text-sm')}
      // Replaces Card's default drop shadow — a callout sits flat in prose.
      cardStyle={{ className: cn('overflow-hidden', className) }}
    >
      {children}
    </Card>
  )
}
