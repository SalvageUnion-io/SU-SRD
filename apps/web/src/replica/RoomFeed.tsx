/**
 * The replica's feed (ADR-064): a socket on the player's account room and one
 * on each of their Games' rooms, each folded into its own scope
 * (`roomSocket.ts`). Mounted by `ReplicaSync` while live. A socket is signed
 * in by the session cookie on its upgrade, and the player's Games are the
 * Worker's `games.listMine`.
 */

import { useEffect, useRef } from 'react'
import { useMyPerson } from '../lib/auth/session'
import { accountSocketPath, gameSocketPath } from '../rooms/routes'
import { gameScope, serve, TABLES } from './replica'
import { useGamesQuery } from './roomCalls'
import { holdGames, openRoom } from './roomSocket'
import { forgetTableState } from './tableState'

function GameFeed({ gameId }: { gameId: string }) {
  useEffect(() => openRoom(gameSocketPath(gameId), gameScope(gameId), gameId), [gameId])
  return null
}

export function RoomFeed() {
  const person = useMyPerson()
  const games = useGamesQuery('games.listMine', {})
  useEffect(() => {
    if (person === null) return
    return openRoom(accountSocketPath(), 'account')
  }, [person])
  // A Game the player is no longer in: its room's rows are not theirs now.
  // Offline the feed unmounts and every row stays, as the device kept it.
  const was = useRef<readonly string[]>([])
  useEffect(() => {
    if (games === undefined) return
    const now = games.map((g) => g._id)
    for (const gameId of was.current) {
      if (now.includes(gameId)) continue
      serve(gameScope(gameId), TABLES, [])
      forgetTableState(gameScope(gameId))
    }
    was.current = now
    holdGames(now)
  }, [games])
  useEffect(() => () => holdGames(null), [])
  if (person === null) return null
  return (
    <>
      {games?.map((game) => (
        <GameFeed key={`${person}:${game._id}`} gameId={game._id} />
      ))}
    </>
  )
}
