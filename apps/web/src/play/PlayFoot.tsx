/**
 * PlayFoot — the Cockpit's foot: whether play is being saved
 * (`SavedIndicator`, which says Saved, Connecting… or Offline ·
 * read-only from the one connection source) and the connection line, who
 * play is reaching (`connectionLine`) beside it, on the left (the wireframes),
 * then the screen's own `note` at the end (the Mediator's: players see the
 * Opposition only through what is posted).
 */

import type { CSSProperties } from 'react'
import type { ChapterTone } from '../components/atoms/chapterBandColor'
import { tokens } from '../components/index'
import { useConnection } from '../lib/connection/connectionContext'
import { connectionLine, phaseBand } from './play.model'
import { SavedIndicator } from './SavedIndicator'

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
  const { mode } = useConnection()
  return (
    <footer className="su-play-band" style={{ ...FOOT, ...phaseBand(tone).style }}>
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
