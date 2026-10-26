/**
 * What a table plays under, read and written the same way whichever server
 * holds it: the Scene, the salvage area, the ledger, the boundaries and the
 * Stop Sign (4.3), the Mediator's Opposition tray and running encounter, and
 * the table in play: the seats, the Downtime, the proposals and the feed.
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
import { useMyPerson } from '../lib/auth/session'
import type { Scope } from './replica'
import { gameScope } from './replica'
import { ROOM_FEED, roomOf } from './roomSocket'
import { WritesBlockedOffline } from './sync'
import type { StateTable } from './tableState'
import { readTableState, subscribeTableState } from './tableState'

/** A query's args, as a screen passes them. */
type Args = { gameId?: string | null; pilotId?: string; limit?: number }

/**
 * How a room answers a query a screen reads: the record table that holds it
 * (by the query's args, where they choose), and what of that record the query
 * answered, when not all of it. An answer keeps undefined (not yet served) as
 * it is.
 */
type Answer = {
  table: StateTable | ((args: Args) => StateTable)
  answer?: (held: unknown, args: Args) => unknown
}

/** The newest `limit` of a feed, as Convex's `take(limit)` read it. */
function newest(fallback: number) {
  return (held: unknown, args: Args) => (held as unknown[]).slice(0, args.limit ?? fallback)
}

/** A solo pilot's seat, as `seats.solo` answered: null for one not on the Shelf. */
function soloSeat(held: unknown, args: Args): SoloSeat | null {
  return (held as SoloSeat[]).find((seat) => seat.pilotId === args.pilotId) ?? null
}
type SoloSeat = {
  pilotId: string
  downtime: {
    stepIndex: number
    startedAt: number
    upkeepSpent: boolean
    doneSteps: number[]
  } | null
}

const NOT_RUNNING = {
  running: false,
  stepIndex: null,
  startedAt: null,
  completedBy: [],
  upkeepSpent: false,
  doneSteps: [],
}

/**
 * `downtime.state`: a Game's, with the steps `pilotId` took; or a solo
 * pilot's, off its seat (null for one not on the Shelf).
 */
function downtimeState(held: unknown, args: Args): unknown {
  if (args.gameId != null) {
    const game = held as { doneSteps: Record<string, number[]> } | null
    if (game === null) return null
    return { ...game, doneSteps: game.doneSteps[args.pilotId ?? ''] ?? [] }
  }
  const seat = soloSeat(held, args)
  if (seat === null) return null
  return seat.downtime === null ? NOT_RUNNING : { ...seat.downtime, running: true, completedBy: [] }
}

/** Each query a screen reads, by its Convex name. */
const ANSWERED_BY: Record<string, Answer> = {
  'scenes:current': { table: 'scene' },
  'salvageAreas:here': { table: 'salvageArea' },
  'ledger:get': { table: 'ledger' },
  'safety:boundaries': { table: 'boundaries' },
  'safety:stopSign': { table: 'safety' },
  // The one `mediator` record is the running encounter, and having it at all is mediating.
  'mediator:npcs': { table: 'opposition' },
  'mediator:running': {
    table: 'mediator',
    answer: (held) => (held as { running?: unknown } | null)?.running ?? null,
  },
  'mediator:amMediator': { table: 'mediator', answer: (held) => held !== null },
  'seats:forGame': { table: 'seats' },
  'seats:solo': { table: 'seats', answer: soloSeat },
  'downtime:state': {
    table: (args) => (args.gameId == null ? 'seats' : 'downtime'),
    answer: downtimeState,
  },
  'ops:pending': { table: 'proposals' },
  'ops:sent': { table: 'sentProposals', answer: newest(20) },
  'changeLog:rolls': { table: 'rolls', answer: newest(30) },
  'changeLog:alerts': { table: 'alerts', answer: newest(20) },
  'crew:vitals': { table: 'crew' },
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

/** Each answer made from a held record, per args: stable between changes, for `useSyncExternalStore`. */
const made = new WeakMap<object, Map<string, unknown>>()

function answered(how: Answer, held: unknown, args: Args): unknown {
  if (held === undefined || how.answer === undefined) return held
  if (held === null || typeof held !== 'object') return how.answer(held, args)
  const key = JSON.stringify(args)
  const answers = made.get(held) ?? new Map<string, unknown>()
  made.set(held, answers)
  if (!answers.has(key)) answers.set(key, how.answer(held, args))
  return answers.get(key)
}

const useRoomRead: Read = (query, args) => {
  const how = ANSWERED_BY[getFunctionName(query)]
  const given = args === 'skip' || how === undefined ? null : (args as Args)
  return useSyncExternalStore(subscribeTableState, () => {
    if (given === null || how === undefined) return undefined
    const table = typeof how.table === 'string' ? how.table : how.table(given)
    const held = readTableState(scopeOf(given.gameId ?? null), table)
    return answered(how, held, given)
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

/**
 * The signed-in player, as the table-in-play records name them: their Discord
 * id while the rooms feed the replica, else their Convex user id (`convexId`).
 */
export const useViewerId: (convexId: string | null) => string | null = ROOM_FEED
  ? () => useMyPerson()
  : (convexId) => convexId
