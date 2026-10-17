import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize } from '../../design/tokens'
import { Box } from './Box'
import { TitledBox } from './TitledBox'

/**
 * Callout accents — the closed set (ruleset §4.1: colour lives in tokens, not
 * call sites). Entity tones frame entity-flavoured notes; `bad` is the
 * "When Damaged" accent; `ink` is the neutral note.
 */
type CalloutTone = 'ink' | 'pilot' | 'mech' | 'crawler' | 'bad'

const CALLOUT_ACCENT: Record<CalloutTone, string> = {
  ink: 'var(--color-ink)',
  pilot: 'var(--color-sheet-pilot)',
  mech: 'var(--color-sheet-mech)',
  crawler: 'var(--color-sheet-crawler)',
  bad: 'var(--color-status-bad)',
}

/** A labelled callout's band: the accent's own colour token (`TitledBox`'s `tone`). */
const CALLOUT_BAND: Record<CalloutTone, string> = {
  ink: 'ink',
  pilot: 'sheet-pilot',
  mech: 'sheet-mech',
  crawler: 'sheet-crawler',
  bad: 'status-bad',
}

type CalloutProps = {
  /** Optional title: the callout then wears the cut-out head (`TitledBox`). */
  label?: string
  /** Accent tone — the frame, and (with a label) the band. */
  tone?: CalloutTone
  /** Body content — a paper panel under the header. */
  children?: ReactNode
  className?: string
}

/** The paper body: the box pads it. */
const NOTE_BODY = {
  fontSize: fontSize.sm,
  lineHeight: 1.375,
  color: color.ink,
} satisfies CSSProperties

/**
 * Callout — the accent-framed note: list-item content blocks (NPC
 * motivations, "one of the following" options, the settlement examples) and
 * wizard reminders. Content-agnostic (a Container, not an Atom).
 *
 * With a `label` it is a `TitledBox`: the label on the cut-out of a band in the
 * accent, the note on the paper below, as every titled container. Without
 * one it is the bare `Box`, framed in the accent. The accent is a closed `tone` set,
 * never a raw CSS colour, so a callout cannot drift off the colour system.
 */
export function Callout({ label, tone = 'ink', children, className }: CalloutProps) {
  if (label) {
    return (
      <TitledBox
        title={label}
        tone={CALLOUT_BAND[tone]}
        className={className}
        bodyStyle={NOTE_BODY}
      >
        {children}
      </TitledBox>
    )
  }
  return (
    <Box frameColor={CALLOUT_ACCENT[tone]} className={className} bodyStyle={NOTE_BODY}>
      {children}
    </Box>
  )
}
