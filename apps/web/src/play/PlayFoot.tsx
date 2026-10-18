/**
 * PlayFoot — the Cockpit's foot: whether play is being saved
 * (`SavedIndicator`, which says Saved, Connecting… or Offline ·
 * read-only from the one connection source) and the connection line, who
 * play is reaching (`connectionLine`) beside it, on the left (the wireframes),
 * then the screen's own `note` at the end (the Mediator's: players see the
 * Opposition only through what is posted).
 */

import type { CSSProperties } from 'react'
import { tokens } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { connectionLine } from './play.model'
import { SavedIndicator } from './SavedIndicator'

/** A cream strip like the bar's: the Saved indicator's ink is for a cream panel. */
const FOOT = {
  alignItems: 'center',
  background: 'var(--color-band-cream)',
  borderRadius: tokens.radius.panel,
  display: 'flex',
  gap: tokens.space[16],
  padding: `${tokens.space[4]} ${tokens.space[12]}`,
} satisfies CSSProperties

/** Pushes the note to the foot's end. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

const LINE = {
  color: tokens.color.ink75,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function PlayFoot({
  solo,
  note,
}: {
  /** A solo screen: nothing it does is shared. */
  solo: boolean
  /** A line at the foot's end. */
  note?: string
}) {
  const { mode } = useConnection()
  return (
    <footer style={FOOT}>
      <SavedIndicator />
      <span style={LINE}>{connectionLine(mode, solo)}</span>
      {note && (
        <>
          <span style={SPACER} />
          <span style={LINE}>{note}</span>
        </>
      )}
    </footer>
  )
}
