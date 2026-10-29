/**
 * The Games' calls a screen makes: its Games, a Game's roster and invite,
 * templates, who holds what, where a unit is, a move between rooms, and
 * Discord's channels. Each goes to the Worker (`POST /__rooms/call`,
 * `worker/shared/gameCalls.ts`) by name, typed by the call the Worker
 * answers.
 *
 * A read (`useGamesQuery`) is fetched once per arguments and kept, and
 * fetched again when a room says something changed (`roomChanges.ts`) or
 * after this tab's own write (`useGamesCall`), so a screen stays as current
 * as the rooms it reads.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useMyPerson } from '../lib/auth/session'
import { captureException } from '../lib/observability'
import { ROOMS_CALL_PATH } from '../rooms/routes'
import type { GameCallArgs, GameCallName, GameCallResult } from '../worker/shared/gameCalls'
import { noteRoomChange, roomChangeCount, subscribeRoomChanges } from './roomChanges'
import { RoomDeclined } from './roomSocket'

export type { GameCallArgs, GameCallResult } from '../worker/shared/gameCalls'

/**
 * A call whose request never reached the Worker: the browser's own network
 * failure (`Failed to fetch`, `Load failed`, `NetworkError when attempting to
 * fetch resource.`), or a page unloading mid-request.
 */
export class RoomUnreachable extends Error {}

/** One call to the Worker: its value, or a `RoomDeclined` with the player's words. */
export async function roomCall<N extends GameCallName>(
  name: N,
  args: GameCallArgs<N>
): Promise<GameCallResult<N>> {
  const res = await fetch(ROOMS_CALL_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args }),
  }).catch((cause: unknown) => {
    throw new RoomUnreachable(`${name} did not reach the server`, { cause })
  })
  if (!res.ok) throw new Error(`${name} answered ${res.status}`)
  const answer = (await res.json()) as
    | { ok: true; value: GameCallResult<N> }
    | { ok: false; refusal: string }
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

function fetchAnswer(key: string, name: GameCallName, args: unknown, at: number): void {
  if ((answers.get(key)?.at ?? -1) >= at || (fetching.get(key) ?? -1) >= at) return
  fetching.set(key, at)
  roomCall(name, args as never).then(
    (value) => {
      if ((answers.get(key)?.at ?? -1) > at) return
      answers.set(key, { value, at })
      for (const listener of listeners) listener()
    },
    (error: unknown) => {
      // A refusal on a read is an answer the screen has no way to show, and an
      // unreachable server is the player's network, not a bug: it keeps the last one.
      if (!(error instanceof RoomDeclined || error instanceof RoomUnreachable)) {
        captureException(error)
      }
    }
  )
}

/** A Games read: undefined until its first answer, and while skipped. */
export function useGamesQuery<N extends GameCallName>(
  name: N,
  args: GameCallArgs<N> | 'skip'
): GameCallResult<N> | undefined {
  const argsText = args === 'skip' ? null : JSON.stringify(args)
  const key = argsText === null ? null : `${name} ${argsText}`
  const changes = useSyncExternalStore(subscribeRoomChanges, roomChangeCount)
  useEffect(() => {
    if (key !== null && argsText !== null) fetchAnswer(key, name, JSON.parse(argsText), changes)
  }, [key, name, argsText, changes])
  return useSyncExternalStore(subscribe, () =>
    key === null ? undefined : answers.get(key)?.value
  ) as GameCallResult<N> | undefined
}

/**
 * A Games write: every read is fetched again once it lands. `scope` is what
 * every call from this screen carries (the Game it is in), merged under the
 * call's own arguments.
 */
export function useGamesCall<
  N extends GameCallName,
  S extends Partial<GameCallArgs<N>> = Record<never, never>,
>(name: N, scope?: S): (args: Omit<GameCallArgs<N>, keyof S>) => Promise<GameCallResult<N>> {
  const scopeText = JSON.stringify(scope ?? {})
  return useCallback(
    (args) =>
      roomCall(name, { ...JSON.parse(scopeText), ...args } as GameCallArgs<N>).finally(
        noteRoomChange
      ),
    [name, scopeText]
  )
}

/** The player as a Games read names its members and holders: their Discord id. */
export function useViewerId(): string | null {
  return useMyPerson()
}

/** Forget every answer: the session ended (they were its account's), or a test starts afresh. */
export function forgetGamesAnswers(): void {
  answers.clear()
  fetching.clear()
  for (const listener of listeners) listener()
}
