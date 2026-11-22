/**
 * useGameSession — a Game's group session (`session.state`, live), with the
 * table runner's two writes: start it and end it (play.md §10). The Play hub,
 * the Game's page and the Mediator's screen read it; a session gates nothing,
 * it tells the table that play has begun.
 */

import { toast } from '../components/index'
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
  /** End it; resolves true once the room has it ended. */
  end: () => Promise<boolean>
  pending: boolean
  /** Its Game: ending lands its Mediator on the Game's page and its recap (r6 C1). */
  gameId?: string
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
    start: async () => {
      const result = await start.run({})
      // It began, said back to whoever started it (r3 A4): the table hears its own line.
      if (result.ok && result.value === true) {
        toast.success(playCopy('sessionStarted'), { id: 'group-session' })
      }
      return result.ok
    },
    end: async () => (await end.run({})).ok,
    pending: start.pending || end.pending,
    gameId,
  }
}
