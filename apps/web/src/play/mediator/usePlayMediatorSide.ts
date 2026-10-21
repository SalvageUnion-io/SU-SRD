/**
 * usePlayMediatorSide — what the Mediator's side sections share (play.md
 * §10): the screen's Post toggle, private by default, the roll dispatch with
 * the Game's log left out (the log is the crew's; the Opposition reaches them
 * only through what is posted), and the Feed's lines.
 *
 * Called once per screen: by `PlayMediatorSide` on the canvas, by
 * `PlayMediatorPhone` on a phone. Only one form is ever mounted, so the
 * dispatch runs exactly once whichever tab is open.
 */

import { useState } from 'react'
import type { PlayBinding } from '../channels.model'
import { playFeedEntries } from '../feed.model'
import { mediatorTarget } from '../play.model'
import { usePlayRollLog } from '../playRolls.model'
import type { PlayRollDispatch } from '../usePlayChannel'
import { postDefault, usePlayRollDispatch } from '../usePlayChannel'
import type { PlayMediator } from './usePlayMediator'

/** Who the Feed says rolled from this screen. */
const ROLLER = 'Mediator'

export type PlayMediatorSideState = {
  binding: PlayBinding | null | undefined
  /** The screen's Post toggle, private by default. */
  post: boolean
  setPost: (post: boolean) => void
  dispatch: PlayRollDispatch
  /** The Feed's lines, newest first. */
  entries: ReturnType<typeof playFeedEntries>
}

export function usePlayMediatorSide(
  mediator: PlayMediator,
  binding: PlayBinding | null | undefined
): PlayMediatorSideState {
  const target = mediatorTarget(mediator.gameId)
  const [post, setPost] = useState(() => postDefault(target))
  const dispatch = usePlayRollDispatch({ target, rollerName: ROLLER, post, binding, log: false })

  // This screen's own entries: those recorded since it opened.
  const [openedAt] = useState(() => Date.now())
  const log = usePlayRollLog()
  const entries = playFeedEntries({
    rolls: mediator.rolls,
    alerts: mediator.alerts,
    proposals: [],
    mine: log.filter((roll) => roll.at >= openedAt),
    rollerName: ROLLER,
  })
  return { binding, post, setPost, dispatch, entries }
}
