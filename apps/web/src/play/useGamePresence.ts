/**
 * useGamePresence — who is at a Game's table (play.md §7): the member ids
 * sitting at it, as the Game's room says on the socket the replica already
 * holds open (`replica/presence.ts`). A `seat` caller (a Cockpit) sits its
 * player at the table while it is mounted (`sitAt`); a watcher (the landing)
 * only hears. null until the room says, offline or signed out.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { readPresence, subscribePresence } from '../replica/presence'
import { gameScope } from '../replica/replica'
import { sitAt } from '../replica/roomSocket'

export function useGamePresence(
  gameId: string | null,
  role: 'seat' | 'watch'
): ReadonlySet<string> | null {
  useEffect(() => (gameId !== null && role === 'seat' ? sitAt(gameId) : undefined), [gameId, role])
  return useSyncExternalStore(subscribePresence, () =>
    gameId === null ? null : readPresence(gameScope(gameId))
  )
}
