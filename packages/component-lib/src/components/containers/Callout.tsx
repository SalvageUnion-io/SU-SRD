import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Card } from './Card'

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
  /** Body content — a paper panel under the header. */
  children?: ReactNode
  className?: string
}

/** The band is tighter than a card header and has no min-height — it sizes to
 * the stamp riding in it. */
const BAND = { minHeight: 0, padding: `${space[6]} ${space[12]}` } satisfies CSSProperties

const BODY = {
  padding: space[12],
  fontSize: fontSize.sm,
  lineHeight: 1.375,
  color: color.ink,
} satisfies CSSProperties

/** Replaces Card's default drop shadow — a callout sits flat in prose. */
const FRAME = { overflow: 'hidden' } satisfies CSSProperties

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
export function Callout({ label, tone = 'ink', children, className }: CalloutProps) {
  return (
    <Card
      size="large"
      borderColor={CALLOUT_ACCENT[tone]}
      headerBgColor={label ? bandTint(tone) : undefined}
      headerContent={
        label ? (
          <Badge shape="stamp" size="compact">
            {label}
          </Badge>
        ) : undefined
      }
      headerStyle={{ style: BAND }}
      bodyStyle={BODY}
      cardStyle={{ className, style: FRAME }}
    >
      {children}
    </Card>
  )
}
