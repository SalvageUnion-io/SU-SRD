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
 *
 * The Tables and Feed half is `useSideFeed`, which the Mediator's side
 * (`usePlayMediatorSide`) calls too.
 */

import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import type { PlayBinding } from './channels.model'
import type { FeedSources } from './feed.model'
import { playFeedEntries } from './feed.model'
import type { PlayScreen } from './play.model'
import { usePlayRollLog } from './playRolls.model'
import type { PlayColumnProps } from './situation.model'
import { useGameBoardSources } from './useBoardSources'
import type { GameFeed } from './useGameFeed'
import { useGameFeed } from './useGameFeed'
import type { PlayRollDispatch } from './usePlayChannel'
import { postDefault, usePlayChannelBinding, usePlayRollDispatch } from './usePlayChannel'

/** What a screen's Tables and Feed share, the player's or the Mediator's. */
export type SideFeed = {
  binding: PlayBinding | null | undefined
  /** The screen's one Post toggle. */
  post: boolean
  setPost: (post: boolean) => void
  dispatch: PlayRollDispatch
  /** The Feed's lines, newest first. */
  entries: ReturnType<typeof playFeedEntries>
}

/**
 * The screen's Post toggle (`postDefault`: the Mediator's private), its roll
 * dispatch, and the Feed's lines: the Game's rolls, alerts and proposals with
 * this screen's own entries, those recorded since it opened.
 */
export function useSideFeed({
  target,
  rollerName,
  binding,
  log = true,
  rolls,
  alerts,
  proposals,
}: Pick<FeedSources, 'rolls' | 'alerts' | 'proposals'> & {
  target: PlayScreen
  /** Who the Feed and the Game's log say rolled from this screen. */
  rollerName: string
  binding: PlayBinding | null | undefined
  /** Write each roll to the Game's log; the Mediator's screen does not. */
  log?: boolean
}): SideFeed {
  const [post, setPost] = useState(() => postDefault(target))
  const dispatch = usePlayRollDispatch({ target, rollerName, post, binding, log })
  const [openedAt] = useState(() => Date.now())
  const mine = usePlayRollLog().filter((roll) => roll.at >= openedAt)
  const entries = playFeedEntries({ rolls, alerts, proposals, mine, rollerName })
  return { binding, post, setPost, dispatch, entries }
}

export type PlaySide = SideFeed & {
  feed: GameFeed
  seats: ReturnType<typeof useGameBoardSources>['seats']
}

export function usePlaySide({ target, play }: PlayColumnProps): PlaySide {
  const inGame = target.gameId !== null
  const feed = useGameFeed(play.pilot)
  const sources = useGameBoardSources(target.gameId as Id<'games'> | null)
  const binding = usePlayChannelBinding(target)
  const side = useSideFeed({
    target,
    // The name the crew calls them by, as the Game's log and the bot's card print it.
    rollerName: play.pilot?.callsign || play.pilot?.name || 'Pilot',
    binding,
    rolls: inGame ? feed.rolls : null,
    alerts: inGame ? feed.alerts : [],
    proposals: inGame ? feed.proposals : [],
  })
  return { ...side, feed, seats: sources.seats }
}
