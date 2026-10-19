/**
 * Play's Discord channel (play.md §9): which channel this screen's rolls post
 * to, the screen's one Post toggle, and the dispatch that sends each roll
 * recorded in Play (`playRolls`) where it goes.
 *
 *  - `usePlayChannelBinding(target)`: the bound channel
 *    (`channelBindings.current`), the Game's or, solo, my own; undefined while
 *    it loads or with no server to ask, null when nothing is bound.
 *  - `usePlayRollDispatch(...)`: for every roll recorded while the screen is
 *    open, the Game's log row (in a Game, but never the Mediator's) and the
 *    post (`postRoll`), with
 *    each roll's post state for its Feed line. A failure is shown, never
 *    swallowed; a roll the toggle kept private can still be posted from its
 *    line (`postNow`), and a failed one tried again.
 *
 * The Post toggle's default is `postsByDefault`: a player's rolls post, the
 * Mediator's stay private; solo posts to my own channel.
 */

import { useAction, useQuery } from 'convex/react'
import type { PostRollResult } from 'game-domain/games/discord'
import { postsByDefault } from 'game-domain/games/discord'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import { failureMessage } from '../lib/connection/useServerAction'
import { commitChangeLog } from '../stores/entityBackend'
import type { PlayBinding } from './channels.model'
import type { PlayTarget } from './play.model'
import type { PlayRoll } from './playRolls.model'
import { isDiceRoll, onPlayRoll, playRollDescription, rollLogEntry } from './playRolls.model'

/** One roll's post, as its Feed line says it. */
export type PlayPostState = { kind: 'posting' } | PostRollResult

/** The bound channel: undefined while unknown, null when none is bound. */
export function usePlayChannelBinding(
  target: Pick<PlayTarget, 'gameId'>
): PlayBinding | null | undefined {
  const { mode } = useConnection()
  return useQuery(
    api.channelBindings.current,
    mode !== 'connected'
      ? 'skip'
      : target.gameId === null
        ? {}
        : { gameId: target.gameId as Id<'games'> }
  ) as PlayBinding | null | undefined
}

/** The Post toggle's default for this screen: private for the Mediator. */
export function postDefault(target: Pick<PlayTarget, 'gameId' | 'mediator'>): boolean {
  return postsByDefault(target.gameId === null ? null : { mediator: target.mediator })
}

type DispatchArgs = {
  target: Pick<PlayTarget, 'gameId' | 'pilotId'>
  /** Who the Game's log says rolled: the pilot's name. */
  rollerName: string
  /** The screen's Post toggle. */
  post: boolean
  /** The bound channel, as `usePlayChannelBinding` read it. */
  binding: PlayBinding | null | undefined
  /**
   * Write each roll to the Game's log (the default). The Mediator's screen
   * keeps its rolls off it: the log is the crew's to read, and the
   * Opposition's rolls reach the players only when posted (play.md §10).
   */
  log?: boolean
}

export type PlayRollDispatch = {
  /** Each roll's post, by roll id; absent for a change, or before it is sent. */
  posts: ReadonlyMap<string, PlayPostState>
  /** Post this roll now, whatever the toggle said: the per-roll override, and Try again. */
  postNow: (roll: PlayRoll) => void
}

export function usePlayRollDispatch({
  target,
  rollerName,
  post,
  binding,
  log = true,
}: DispatchArgs): PlayRollDispatch {
  const { canWrite } = useConnection()
  const postRoll = useAction(api.channelBindings.postRoll)
  const [posts, setPosts] = useState<ReadonlyMap<string, PlayPostState>>(() => new Map())

  // The listener reads the latest of these, so it subscribes once.
  const latest = useRef({ target, rollerName, post, binding, canWrite, postRoll, log })
  latest.current = { target, rollerName, post, binding, canWrite, postRoll, log }

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
          message: 'Not posted: Play is read-only for now.',
        })
        return
      }
      if (b === null) {
        settle(roll.id, { kind: 'unbound' })
        return
      }
      settle(roll.id, { kind: 'posting' })
      action({
        ...(t.gameId === null ? {} : { gameId: t.gameId as Id<'games'> }),
        // The Mediator's screen plays no pilot (''): the card names the account.
        ...(t.pilotId === '' ? {} : { pilotId: t.pilotId }),
        roll: { tableName: roll.tableName || roll.label, rolls: roll.rolls },
        post: true,
      })
        .then((result: PostRollResult) => settle(roll.id, result))
        .catch((err: unknown) =>
          settle(roll.id, {
            kind: 'failed',
            channelId: b?.channelId ?? null,
            message: failureMessage(err, 'The roll did not reach Discord.'),
          })
        )
    },
    [settle]
  )

  useEffect(
    () =>
      onPlayRoll((roll) => {
        if (!isDiceRoll(roll)) return
        const {
          target: t,
          rollerName: name,
          post: toggle,
          canWrite: writable,
          log: toLog,
        } = latest.current
        if (t.gameId !== null && writable && toLog) {
          void commitChangeLog([
            rollLogEntry(
              t.gameId,
              {
                description: playRollDescription(name, roll),
                result: {
                  kind: roll.tableName === 'Core Mechanic' ? 'core' : 'table',
                  roll: roll.rolls[0] ?? null,
                  outcome: roll.outcome ?? '',
                },
              },
              roll.at
            ),
          ])
        }
        if (roll.post ?? toggle) send(roll)
        else settle(roll.id, { kind: 'skipped' })
      }),
    [send, settle]
  )

  return { posts, postNow: send }
}
