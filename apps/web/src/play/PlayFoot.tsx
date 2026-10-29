/**
 * PlayFoot — the Cockpit's foot: the connection line, who play is reaching
 * (`connectionLine`), on the left, then the screen's own `note` at the end (the Mediator's: players see the
 * Opposition only through what is posted).
 */

import type { CSSProperties } from 'react'
import type { ChapterTone } from '../components/index'
import { tokens } from '../components/index'
import { useSync } from '../replica/syncContext'
import { connectionLine, phaseBand } from './play.model'

/**
 * The foot matches the bar (ruleset §3.11: a page ends in the colour it leads
 * with): the phase's band and its foreground (`phaseBand`), crossfading with
 * the bar (`.su-play-band`).
 */
const FOOT = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[16],
  padding: `${tokens.space[4]} ${tokens.space[12]}`,
} satisfies CSSProperties

/** Pushes the note to the foot's end. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

const LINE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function PlayFoot({
  solo,
  note,
  tone = 'play',
}: {
  /** A solo screen: nothing it does is shared. */
  solo: boolean
  /** A line at the foot's end. */
  note?: string
  /** The phase's band, the bar's (`PHASE_TONE`); the Cantina's pink by default. */
  tone?: ChapterTone
}) {
  const line = connectionLine(useSync().status, solo)
  return (
    <footer className="su-play-band" style={{ ...FOOT, ...phaseBand(tone).style }}>
      {line && <span style={LINE}>{line}</span>}
      {note && (
        <>
          <span style={SPACER} />
          <span style={LINE}>{note}</span>
        </>
      )}
    </footer>
  )
}
