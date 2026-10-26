/**
 * The replica's feed from the cutover (ADR-064): a socket on the player's
 * account room and one on each of their Games' rooms, each folded into its
 * own scope (`roomSocket.ts`). Mounted by `ReplicaSync` in `ConvexFeed`'s
 * place while live, when the build turns it on (`VITE_ROOM_FEED`).
 *
 * A socket carries the Worker's session token, as the presence socket does
 * (`worker/roomAuth.ts`), and the player's Games are Convex's `games.listMine`.
 */

import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { useSessionToken } from '../lib/auth/session'
import { accountSocketPath, gameSocketPath } from '../rooms/routes'
import { gameScope, serve, setRoomScopes, TABLES } from './replica'
import { useGamesQuery } from './roomCalls'
import { openRoom } from './roomSocket'
import { forgetTableState } from './tableState'

function GameFeed({ gameId, token }: { gameId: string; token: string }) {
  useEffect(
    () => openRoom(gameSocketPath(gameId), gameScope(gameId), token, gameId),
    [gameId, token]
  )
  return null
}

export function RoomFeed() {
  const token = useSessionToken()
  const games = useGamesQuery(api.games.listMine, {})
  useEffect(() => {
    setRoomScopes(true)
    return () => setRoomScopes(false)
  }, [])
  useEffect(() => {
    if (token === null) return
    return openRoom(accountSocketPath(), 'account', token)
  }, [token])
  // A Game the player is no longer in: its room's rows are not theirs now.
  // Offline the feed unmounts and every row stays, as the device kept it.
  const was = useRef<readonly string[]>([])
  useEffect(() => {
    if (games === undefined) return
    const now = games.map((g) => g._id as string)
    for (const gameId of was.current) {
      if (now.includes(gameId)) continue
      serve(gameScope(gameId), TABLES, [])
      forgetTableState(gameScope(gameId))
    }
    was.current = now
  }, [games])
  if (token === null) return null
  return (
    <>
      {games?.map((game) => (
        <GameFeed key={game._id} gameId={game._id} token={token} />
      ))}
    </>
  )
}
