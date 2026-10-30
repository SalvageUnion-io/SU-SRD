import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize } from '../../design/tokens'
import { Box } from './Box'

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

type CalloutProps = {
  /** Accent tone — the frame. */
  tone?: CalloutTone
  /** Body content — the framed paper panel. */
  children?: ReactNode
  className?: string
  /** A role on the root (`note`: a note in a page's `main`, never an `<aside>` landmark). */
  role?: string
  /** Its body takes its context's type (a guide's reading size), not the note size. */
  prose?: boolean
}

/** The paper body: the box pads it. */
const NOTE_BODY = {
  fontSize: fontSize.body,
  lineHeight: 1.375,
  color: color.ink,
} satisfies CSSProperties

/**
 * Callout — the accent-framed note: list-item content blocks (NPC
 * motivations, "one of the following" options, the settlement examples) and
 * wizard reminders. Content-agnostic (a Container, not an Atom).
 *
 * It is unlabelled (ruleset §5, N5): the bare `Box`, framed in the accent; a
 * note that needs a name wears a seam stamp in its body (a guide's "Note"). The
 * accent is a closed `tone` set, never a raw CSS colour, so a callout cannot
 * drift off the colour system.
 */
export function Callout({ tone = 'ink', children, className, role, prose = false }: CalloutProps) {
  return (
    <Box
      frameColor={CALLOUT_ACCENT[tone]}
      className={className}
      role={role}
      bodyStyle={prose ? undefined : NOTE_BODY}
    >
      {children}
    </Box>
  )
}
