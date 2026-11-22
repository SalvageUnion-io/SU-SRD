/**
 * Play's Discord channel (play.md §9): which channel this screen's rolls post
 * to, and the dispatch that sends each roll recorded in Play (`playRolls`)
 * there.
 *
 *  - `usePlayChannelBinding(target)`: the bound channel
 *    (`channelBindings.current`): the Game's, or my own where the Game has
 *    none and solo; undefined while it loads or with no server to ask, null
 *    when nothing is bound.
 *  - `usePlayRollDispatch(...)`: for every roll recorded while the screen is
 *    open, the Game's log row (in a Game) and the post (`postRoll`), with
 *    each roll's post state for its Feed line. A private roll (the
 *    Mediator's switch) is logged private and never posted. An Opposition
 *    roll is logged veiled, and its card names its table, never the NPC. A
 *    failure is shown, never swallowed, and a failed one can be tried again
 *    from its line (`postNow`).
 *
 * Every roll but a private one posts while a channel is bound, the Mediator's
 * too: there is no opt-in. `/su unbind` is how rolls stop posting.
 *
 * A roll made while Play cannot write (offline) is held (r5 A6): its line says
 * "Not sent yet", and it is logged and posted once the connection returns, or
 * when its Try again is pressed then. Held in memory, for the open tab.
 */

import type { PostRollResult } from 'game-domain/games/discord'
import { useCallback, useEffect, useRef, useState } from 'react'
import { failureMessage } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import { sendChangeLog } from '../replica/outbox'
import { useGamesCall, useGamesQuery } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import type { PlayBinding } from './channels.model'
import type { PlayScreen, PlayTarget } from './play.model'
import type { PlayRoll } from './playRolls.model'
import {
  isDiceRoll,
  onPlayRoll,
  playRollDescription,
  rollLogEntry,
  veiledRollDescription,
} from './playRolls.model'
import { CORE_MECHANIC_TABLE } from './tables.model'

/** One roll's post, as its Feed line says it; `held` is a roll not sent yet (r5 A6). */
export type PlayPostState = { kind: 'posting' } | { kind: 'held' } | PostRollResult

/** The bound channel: undefined while unknown, null when none is bound. */
export function usePlayChannelBinding(
  target: Pick<PlayTarget, 'gameId'>
): PlayBinding | null | undefined {
  const { status } = useSync()
  return useGamesQuery(
    'channelBindings.current',
    status !== 'live' ? 'skip' : target.gameId === null ? {} : { gameId: target.gameId }
  ) as PlayBinding | null | undefined
}

type DispatchArgs = {
  target: Pick<PlayScreen, 'gameId' | 'pilotId'>
  /** Who the Game's log says rolled: the pilot's name. */
  rollerName: string
  /** The bound channel, as `usePlayChannelBinding` read it. */
  binding: PlayBinding | null | undefined
}

export type PlayRollDispatch = {
  /** Each roll's post, by roll id; absent for a change, or before it is sent. */
  posts: ReadonlyMap<string, PlayPostState>
  /** Post this roll again: a failed one's Try again; a held one is sent whole. */
  postNow: (roll: PlayRoll) => void
}

export function usePlayRollDispatch({
  target,
  rollerName,
  binding,
}: DispatchArgs): PlayRollDispatch {
  const { canWrite } = useSync()
  const postRoll = useGamesCall('channelBindings.postRoll')
  const [posts, setPosts] = useState<ReadonlyMap<string, PlayPostState>>(() => new Map())

  // The listener reads the latest of these, so it subscribes once.
  const latest = useRef({ target, rollerName, binding, canWrite, postRoll })
  latest.current = { target, rollerName, binding, canWrite, postRoll }

  const settle = useCallback((id: string, state: PlayPostState) => {
    setPosts((prev) => new Map(prev).set(id, state))
  }, [])
  const forget = useCallback((id: string) => {
    setPosts((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])
  // The rolls made while Play could not write, oldest first, by id.
  const held = useRef(new Map<string, PlayRoll>())

  const send = useCallback(
    (roll: PlayRoll) => {
      const { target: t, binding: b, canWrite: writable, postRoll: action } = latest.current
      if (!writable) {
        settle(roll.id, { kind: 'held' })
        return
      }
      if (b === null) {
        settle(roll.id, { kind: 'unbound' })
        return
      }
      settle(roll.id, { kind: 'posting' })
      action({
        ...(t.gameId === null ? {} : { gameId: t.gameId }),
        // The Mediator's screen plays no pilot: the card names the account.
        ...(t.pilotId === null ? {} : { pilotId: t.pilotId }),
        roll: {
          tableName: roll.tableName || roll.label,
          rolls: roll.rolls,
          // What the roll was for (an ability's name), which the card prints. The
          // Mediator's is left off: its label names the Opposition.
          // A veiled roll's never is (ADR-051 §9b).
          ...(t.pilotId !== null && !roll.veiled && roll.label && roll.label !== roll.tableName
            ? { label: roll.label }
            : {}),
        },
      })
        .then((result: PostRollResult) => settle(roll.id, result))
        .catch((err: unknown) =>
          settle(roll.id, {
            kind: 'failed',
            channelId: b?.channelId ?? null,
            message: failureMessage(err, playCopy('rollDidNotReachDiscord')),
          })
        )
    },
    [settle]
  )

  /** The roll to the Game's log and its post: once Play can write. */
  const deliver = useCallback(
    (roll: PlayRoll) => {
      const { target: t, rollerName: name } = latest.current
      if (t.gameId !== null) {
        void sendChangeLog([
          rollLogEntry(
            t.gameId,
            {
              description: playRollDescription(name, roll),
              result: {
                kind: roll.tableName === CORE_MECHANIC_TABLE ? 'core' : 'table',
                roll: roll.rolls[0] ?? null,
                outcome: roll.outcome ?? '',
              },
              ...(roll.private ? { private: true as const } : {}),
              // The Opposition's names stay in the room (ADR-051 §9b).
              ...(roll.veiled ? { veiled: veiledRollDescription(roll) } : {}),
              ...(roll.slot === undefined ? {} : { slot: roll.slot }),
            },
            roll.at
          ),
        ])
      }
      // A private roll stays off Discord: nothing mirrors it out of the room.
      if (roll.private || !isDiceRoll(roll)) forget(roll.id)
      else send(roll)
    },
    [send, forget]
  )

  useEffect(
    () =>
      onPlayRoll((roll) => {
        // A line in a slot is the Game's to read even without dice: what a wreck yielded (r5 B2).
        if (!isDiceRoll(roll) && roll.slot === undefined) return
        if (latest.current.canWrite) return deliver(roll)
        held.current.set(roll.id, roll)
        settle(roll.id, { kind: 'held' })
      }),
    [deliver, settle]
  )

  // Back online: what was held is sent, oldest first.
  useEffect(() => {
    if (!canWrite) return
    const waiting = [...held.current.values()]
    held.current.clear()
    for (const roll of waiting) deliver(roll)
  }, [canWrite, deliver])

  const postNow = useCallback(
    (roll: PlayRoll) => {
      if (!held.current.has(roll.id)) return send(roll)
      if (!latest.current.canWrite) return
      held.current.delete(roll.id)
      deliver(roll)
    },
    [send, deliver]
  )

  return { posts, postNow }
}
