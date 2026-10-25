/**
 * What a table plays under, read and written the same way whichever server
 * holds it: the Scene, the salvage area, the ledger, the boundaries and the
 * Stop Sign (4.3).
 *
 * `useTableRead` stands in for Convex's `useQuery`, and `useTableAct` for its
 * `useMutation`, on those functions. A Game room serves each query's answer as
 * a record (`tableState.ts`) and takes each mutation as an act under the
 * function's own name, so a screen swaps one call for the other and nothing
 * else. The build's feed (`ROOM_FEED`) picks which; the cutover deletes the
 * Convex half.
 */

import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { useCallback, useSyncExternalStore } from 'react'
import type { Scope } from './replica'
import { gameScope } from './replica'
import { ROOM_FEED, roomOf } from './roomSocket'
import { WritesBlockedOffline } from './sync'
import type { StateTable } from './tableState'
import { readTableState, subscribeTableState } from './tableState'

/** The record table that answers each query a screen reads. */
const ANSWERED_BY: Record<string, StateTable> = {
  'scenes:current': 'scene',
  'salvageAreas:here': 'salvageArea',
  'ledger:get': 'ledger',
  'safety:boundaries': 'boundaries',
  'safety:stopSign': 'safety',
}

type Query = FunctionReference<'query'>
type Mutation = FunctionReference<'mutation'>
type Read = <Q extends Query>(
  query: Q,
  args: FunctionArgs<Q> | 'skip'
) => FunctionReturnType<Q> | undefined
type Act = <M extends Mutation>(
  mutation: M,
  gameId: string | null
) => (args: FunctionArgs<M>) => Promise<FunctionReturnType<M>>

/** A Game's room, or the account room's for the solo table (`gameId` null). */
function scopeOf(gameId: string | null): Scope {
  return gameId === null ? 'account' : gameScope(gameId)
}

const useRoomRead: Read = (query, args) => {
  const table = ANSWERED_BY[getFunctionName(query)]
  const scope =
    args === 'skip' || table === undefined
      ? null
      : scopeOf((args as { gameId?: string | null }).gameId ?? null)
  return useSyncExternalStore(subscribeTableState, () =>
    scope === null || table === undefined ? undefined : readTableState(scope, table)
  ) as never
}

const useConvexRead: Read = (query, args) => useQuery(query, args as never)

const useRoomAct: Act = (mutation, gameId) => {
  const name = getFunctionName(mutation).replace(':', '.')
  return useCallback(
    (args) => {
      const room = roomOf(gameId)
      return room === null
        ? Promise.reject(new WritesBlockedOffline())
        : (room.act(name, args) as Promise<never>)
    },
    [name, gameId]
  )
}

const useConvexAct: Act = (mutation) => useMutation(mutation) as never

/** `useQuery` on a table's state: its room's record while the rooms feed the replica. */
export const useTableRead: Read = ROOM_FEED ? useRoomRead : useConvexRead

/** `useMutation` on a table's state, sent to `gameId`'s room as an act while the rooms feed the replica. */
export const useTableAct: Act = ROOM_FEED ? useRoomAct : useConvexAct
