/**
 * The Games' calls a screen makes, read and written the same way whichever
 * server holds them: its Games, a Game's roster and invite, templates, who
 * holds what, where a unit is, and Discord's channels.
 *
 * `useGamesQuery` stands in for Convex's `useQuery`, `useGamesMutation` for
 * `useMutation` and `useGamesAction` for `useAction`, on those functions.
 * While the rooms feed the replica (`ROOM_FEED`) each goes to the Worker
 * (`POST /__rooms/call`, `worker/shared/gameCalls.ts`) under its Convex
 * function's own name, so a screen swaps one hook for the other and nothing
 * else; the cutover deletes the Convex half.
 *
 * A read is fetched once per arguments and kept, and fetched again when a
 * room says something changed (`roomChanges.ts`) or after this tab's own
 * write, as Convex's reactive queries would have.
 */

import { useAction, useMutation, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { api } from '../../convex/_generated/api'
import { useMyPerson } from '../lib/auth/session'
import { captureException } from '../lib/observability'
import { ROOMS_CALL_PATH } from '../rooms/routes'
import { noteRoomChange, roomChangeCount, subscribeRoomChanges } from './roomChanges'
import { ROOM_FEED, RoomDeclined } from './roomSocket'

type Query = FunctionReference<'query'>
type Mutation = FunctionReference<'mutation'>
type Action = FunctionReference<'action'>

/** `games:listMine` as the Worker names it: `games.listMine`. */
const callName = (fn: FunctionReference<'query' | 'mutation' | 'action'>) =>
  getFunctionName(fn).replace(':', '.')

/** One call to the Worker: its value, or a `RoomDeclined` with the player's words. */
export async function roomCall(name: string, args: unknown): Promise<unknown> {
  const res = await fetch(ROOMS_CALL_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args }),
  })
  if (!res.ok) throw new Error(`${name} answered ${res.status}`)
  const answer = (await res.json()) as { ok: true; value: unknown } | { ok: false; refusal: string }
  if (!answer.ok) throw new RoomDeclined(answer.refusal)
  return answer.value
}

/** Each read's last answer, by call and arguments, and the change count it was fetched at. */
const answers = new Map<string, { value: unknown; at: number }>()
const fetching = new Map<string, number>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function fetchAnswer(key: string, name: string, args: unknown, at: number): void {
  if ((answers.get(key)?.at ?? -1) >= at || (fetching.get(key) ?? -1) >= at) return
  fetching.set(key, at)
  roomCall(name, args).then(
    (value) => {
      if ((answers.get(key)?.at ?? -1) > at) return
      answers.set(key, { value, at })
      for (const listener of listeners) listener()
    },
    (error: unknown) => {
      // A refusal on a read is an answer the screen has no way to show: it keeps the last one.
      if (!(error instanceof RoomDeclined)) captureException(error)
    }
  )
}

function useRoomQuery<Q extends Query>(
  query: Q,
  args: FunctionArgs<Q> | 'skip' = {} as FunctionArgs<Q>
): FunctionReturnType<Q> | undefined {
  const name = callName(query)
  const argsText = args === 'skip' ? null : JSON.stringify(args)
  const key = argsText === null ? null : `${name} ${argsText}`
  const changes = useSyncExternalStore(subscribeRoomChanges, roomChangeCount)
  useEffect(() => {
    if (key !== null && argsText !== null) fetchAnswer(key, name, JSON.parse(argsText), changes)
  }, [key, name, argsText, changes])
  return useSyncExternalStore(subscribe, () =>
    key === null ? undefined : answers.get(key)?.value
  ) as FunctionReturnType<Q> | undefined
}

/** A write through the Worker: every read is fetched again once it lands. */
function useRoomWrite<F extends Mutation | Action>(
  fn: F,
  extra: object
): (args: FunctionArgs<F>) => Promise<FunctionReturnType<F>> {
  const name = callName(fn)
  const scope = JSON.stringify(extra)
  return useCallback(
    async (args) => {
      try {
        return (await roomCall(name, { ...JSON.parse(scope), ...args })) as FunctionReturnType<F>
      } finally {
        noteRoomChange()
      }
    },
    [name, scope]
  )
}

/** `useQuery` on a Games function: the Worker's answer while the rooms feed the replica. */
export const useGamesQuery: <Q extends Query>(
  query: Q,
  args?: FunctionArgs<Q> | 'skip'
) => FunctionReturnType<Q> | undefined = ROOM_FEED
  ? useRoomQuery
  : (query, args = {}) => useQuery(query, args as never)

/**
 * `useMutation` on a Games function, sent to the Worker while the rooms feed
 * the replica. `rooms` is what the Worker needs that Convex found itself (the
 * Game a unit is in, for `ownership.assign`); Convex never sees it.
 */
export function useGamesMutation<M extends Mutation>(
  mutation: M,
  rooms: object = {}
): (args: FunctionArgs<M>) => Promise<FunctionReturnType<M>> {
  const convex = useMutation(mutation) as (args: FunctionArgs<M>) => Promise<FunctionReturnType<M>>
  const room = useRoomWrite(mutation, rooms)
  return ROOM_FEED ? room : convex
}

/** `useAction` on a Games function, sent to the Worker while the rooms feed the replica. */
export function useGamesAction<A extends Action>(
  action: A
): (args: FunctionArgs<A>) => Promise<FunctionReturnType<A>> {
  const convex = useAction(action) as (args: FunctionArgs<A>) => Promise<FunctionReturnType<A>>
  const room = useRoomWrite(action, {})
  return ROOM_FEED ? room : convex
}

/**
 * The player as a Games read names its members and holders: their Discord id
 * while the rooms feed the replica (`useMyPerson`), Convex's user id before.
 */
export function useViewerId(signedIn = true): string | null {
  const person = useMyPerson()
  const me = useQuery(api.account.me, ROOM_FEED || !signedIn ? 'skip' : {})
  return ROOM_FEED ? person : (me?._id ?? null)
}
