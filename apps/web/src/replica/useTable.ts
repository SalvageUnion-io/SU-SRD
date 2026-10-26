/**
 * What a table plays under, read and written the same way whichever server
 * holds it: the Scene, the salvage area, the ledger, the boundaries and the
 * Stop Sign (4.3), and the Mediator's Opposition tray and running encounter.
 *
 * `useTableRead` stands in for Convex's `useQuery`, and `useTableAct` for its
 * `useMutation`, on those functions. A Game room serves each query's answer as
 * a record (`tableState.ts`) and takes each mutation as an act under the
 * function's own name, so a screen swaps one call for the other and nothing
 * else (but `mediator.runEncounter`, which carries the encounter: a Game room
 * cannot read the Mediator's shelf). The build's feed (`ROOM_FEED`) picks which; the cutover deletes the
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
  'mediator:npcs': 'opposition',
  'mediator:running': 'mediator',
  'mediator:amMediator': 'mediator',
}

/**
 * The queries a table's record answers only in part: the one `mediator`
 * record is the running encounter, and having it at all is mediating.
 * Each keeps undefined (not yet served) as it is.
 */
const ANSWER_OF: Record<string, (held: unknown) => unknown> = {
  'mediator:running': (held) => (held as { running?: unknown } | null)?.running ?? null,
  'mediator:amMediator': (held) => held !== null,
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
  const name = getFunctionName(query)
  const table = ANSWERED_BY[name]
  const answer = ANSWER_OF[name]
  const scope =
    args === 'skip' || table === undefined
      ? null
      : scopeOf((args as { gameId?: string | null }).gameId ?? null)
  return useSyncExternalStore(subscribeTableState, () => {
    if (scope === null || table === undefined) return undefined
    const held = readTableState(scope, table)
    return held === undefined || answer === undefined ? held : answer(held)
  }) as never
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
