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
 *    Mediator's switch) is logged private and never posted. A
 *    failure is shown, never swallowed, and a failed one can be tried again
 *    from its line (`postNow`).
 *
 * Every roll but a private one posts while a channel is bound, the Mediator's
 * too: there is no opt-in. `/su unbind` is how rolls stop posting.
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
import { isDiceRoll, onPlayRoll, playRollDescription, rollLogEntry } from './playRolls.model'
import { CORE_MECHANIC_TABLE } from './tables.model'

/** One roll's post, as its Feed line says it. */
export type PlayPostState = { kind: 'posting' } | PostRollResult

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
  /** Post this roll again: a failed one's Try again. */
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

  const send = useCallback(
    (roll: PlayRoll) => {
      const { target: t, binding: b, canWrite: writable, postRoll: action } = latest.current
      if (!writable) {
        settle(roll.id, {
          kind: 'failed',
          channelId: null,
          message: playCopy('notPostedReadOnly'),
        })
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
          ...(t.pilotId !== null && roll.label && roll.label !== roll.tableName
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

  useEffect(
    () =>
      onPlayRoll((roll) => {
        if (!isDiceRoll(roll)) return
        const { target: t, rollerName: name, canWrite: writable } = latest.current
        if (t.gameId !== null && writable) {
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
              },
              roll.at
            ),
          ])
        }
        // A private roll stays off Discord: nothing mirrors it out of the room.
        if (!roll.private) send(roll)
      }),
    [send]
  )

  return { posts, postNow: send }
}
