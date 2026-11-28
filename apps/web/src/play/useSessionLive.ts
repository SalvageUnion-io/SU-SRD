/**
 * The door into Play as a screen reads it live (`sessionDoor.model.ts`,
 * glossary §9, r3 H3): whether a pilot's Game has a group session running.
 */

import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'

/** Whether `gameId`'s group session is live; false solo, offline or while it loads. */
export function useSessionLive(gameId: string | null | undefined): boolean {
  const { status } = useSync()
  const read = useTableRead(
    'session.state',
    gameId != null && status === 'live' ? { gameId } : 'skip'
  )
  return read?.live === true
}
