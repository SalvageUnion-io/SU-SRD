/**
 * GamePage — the body of `/play/games/$gameId` (ADR-052 §5): who may open a
 * Game's page, in each storage mode.
 *
 *  - **Signed out:** sign in first. There are no Games signed out.
 *  - **Connecting:** a beat while the session settles.
 *  - **Connected:** the page (`GameHub`), which `games.get` answers live: a
 *    Game you are not in reads as an explanation.
 *  - **Disconnected:** a Game is the server's record, so its page waits for the
 *    connection; your own builds stay in the Hangar.
 *
 * The phone's Pilot/Mech/Crawler switch is kept here, so a remount of the hub
 * keeps the column a player picked.
 */

import '../../styles/play/play.css'
import { useState } from 'react'
import type { SegmentKind } from '../../build/roster/RosterColumn'
import { RoutePending } from '../../components/shared/RouteFallbacks'
import { useConnection } from '../../lib/connection/connectionContext'
import { PlayRefusal } from '../PlayRefusal'
import { GameHub } from './GameHub'

export function GamePage({ gameId }: { gameId: string }) {
  const { mode } = useConnection()
  const [segment, setSegment] = useState<SegmentKind>('pilot')
  if (mode === 'solo') {
    return (
      <PlayRefusal
        title="Sign in to open this Game"
        body="A Game lives on its players' accounts. Sign in, then open it from Play."
        link={{ href: '/sign-in', label: 'Sign in with Discord', back: false }}
      />
    )
  }
  if (mode === 'connecting') return <RoutePending label="your session" />
  if (mode === 'disconnected') {
    return (
      <PlayRefusal
        title="This Game opens once you are back online"
        body="A Game's page is read from the server. Your own builds stay in the Hangar meanwhile."
        link={{ href: '/', label: 'Hangar' }}
      />
    )
  }
  // Remount per Game, so one table's busy and error state never shows on the next.
  return (
    <GameHub key={gameId} gameId={gameId} activeSegment={segment} onSegmentChange={setSegment} />
  )
}
