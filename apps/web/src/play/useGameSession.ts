/**
 * useGameSession — a Game's group session (`session.state`, live), with the
 * table runner's two writes: start it and end it (play.md §10). The Play hub,
 * the Game's page and the Mediator's screen read it; a session gates nothing,
 * it tells the table that play has begun.
 */

import { useServerAction } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import { useSync } from '../replica/syncContext'
import { useTableAct, useTableRead } from '../replica/useTable'

export type GameSession = {
  /** A session is running. */
  live: boolean
  /** Writes reach the server. */
  canWrite: boolean
  /** Start it; resolves true once the room has it running. */
  start: () => Promise<boolean>
  end: () => void
  pending: boolean
}

/** The Game's session, or null solo, signed out or while it loads. */
export function useGameSession(gameId: string | null): GameSession | null {
  const { status, canWrite } = useSync()
  const read = useTableRead(
    'session.state',
    gameId !== null && status === 'live' ? { gameId } : 'skip'
  )
  const start = useServerAction(useTableAct('session.start', gameId), {
    failure: playCopy('couldNotStartSession'),
    toastId: 'group-session',
  })
  const end = useServerAction(useTableAct('session.end', gameId), {
    failure: playCopy('couldNotEndSession'),
    toastId: 'group-session',
  })
  if (gameId === null || read == null) return null
  return {
    live: read.live,
    canWrite,
    start: async () => (await start.run({})).ok,
    end: () => void end.run({}),
    pending: start.pending || end.pending,
  }
}
