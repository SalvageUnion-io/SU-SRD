/**
 * usePlaySide — what the player's side sections share (play.md §7–§9): the
 * Game's feed and seats, the bound channel, the screen's one Post toggle, the
 * roll dispatch and the Feed's lines.
 *
 * Called once per screen: by `PlaySideColumn` on the canvas, by
 * `PlayCockpitPhone` on a phone, which puts the sections on its own tabs.
 * Only one form is ever mounted, so the dispatch (`usePlayRollDispatch`),
 * which writes every roll recorded in Play to the Game's log and, per the
 * toggle, to Discord, runs exactly once whichever tab is open.
 */

import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { PlayBinding } from './channels.model'
import { playFeedEntries } from './feed.model'
import { usePlayRollLog } from './playRolls.model'
import type { PlayColumnProps } from './situation.model'
import { useGameBoardSources } from './useBoardSources'
import type { GameFeed } from './useGameFeed'
import { useGameFeed } from './useGameFeed'
import type { PlayRollDispatch } from './usePlayChannel'
import { postDefault, usePlayChannelBinding, usePlayRollDispatch } from './usePlayChannel'

export type PlaySide = {
  feed: GameFeed
  seats: ReturnType<typeof useGameBoardSources>['seats']
  binding: PlayBinding | null | undefined
  /** The screen's one Post toggle. */
  post: boolean
  setPost: (post: boolean) => void
  dispatch: PlayRollDispatch
  /** The Feed's lines, newest first. */
  entries: ReturnType<typeof playFeedEntries>
}

export function usePlaySide({ target, play }: PlayColumnProps): PlaySide {
  const inGame = target.gameId !== null
  const feed = useGameFeed(play.pilot)
  const sources = useGameBoardSources(target.gameId as Id<'games'> | null)
  const binding = usePlayChannelBinding(target)
  const [post, setPost] = useState(() => postDefault(target))
  // The name the crew calls them by, as the Game's log and the bot's card print it.
  const rollerName = play.pilot?.callsign || play.pilot?.name || 'Pilot'
  const dispatch = usePlayRollDispatch({ target, rollerName, post, binding })

  // This screen's own entries: those recorded since it opened.
  const [openedAt] = useState(() => Date.now())
  const log = usePlayRollLog()
  const entries = playFeedEntries({
    rolls: inGame ? feed.rolls : null,
    alerts: inGame ? feed.alerts : [],
    proposals: inGame ? feed.proposals : [],
    mine: log.filter((roll) => roll.at >= openedAt),
    rollerName,
  })
  return { feed, seats: sources.seats, binding, post, setPost, dispatch, entries }
}
