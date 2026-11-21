/**
 * usePlaySide — what the player's side sections share (play.md §7–§9): the
 * Game's feed and seats, the bound channel, the roll dispatch and the Feed's
 * lines.
 *
 * Called once per screen, by `PlayCockpit`, which hands it to the Crew and
 * Tables panes, so the dispatch (`usePlayRollDispatch`), which writes every
 * roll recorded in Play to the Game's log and to the bound Discord channel,
 * runs exactly once whichever pane is open.
 *
 * The Tables and Feed half is `useSideFeed`, which the Mediator's side
 * (`PlayMediatorCockpit`) calls too.
 */

import { mayBindChannel } from 'game-domain/games/discord'
import { pilotLabel } from 'game-domain/pilotLabel'
import { useState } from 'react'
import { useViewerId } from '../replica/roomCalls'
import type { ChannelOwner, PlayBinding } from './channels.model'
import type { FeedSources } from './feed.model'
import { playFeedEntries } from './feed.model'
import type { PlayScreen } from './play.model'
import { usePlayRollLog } from './playRolls.model'
import type { PlayColumnProps } from './situation.model'
import { useGameBoardSources } from './useBoardSources'
import type { GameFeed } from './useGameFeed'
import { useGameFeed } from './useGameFeed'
import type { PlayRollDispatch } from './usePlayChannel'
import { usePlayChannelBinding, usePlayRollDispatch } from './usePlayChannel'

/** What a screen's Tables and Feed share, the player's or the Mediator's. */
export type SideFeed = {
  /** The Game the Feed is of; null at the solo table. */
  gameId: string | null
  binding: PlayBinding | null | undefined
  /** Whose channel the Rolls pane's row is of, and whether the viewer may bind it. */
  channel: { owner: ChannelOwner; mayBind: boolean }
  dispatch: PlayRollDispatch
  /** The Feed's lines, newest first. */
  entries: ReturnType<typeof playFeedEntries>
}

/**
 * The screen's roll dispatch and the Feed's lines: the Game's rolls, alerts and proposals with
 * this screen's own entries, those recorded since it opened.
 */
export function useSideFeed({
  target,
  rollerName,
  binding,
  channel,
  rolls,
  alerts,
  events,
  proposals,
}: Pick<FeedSources, 'rolls' | 'alerts' | 'events' | 'proposals'> & {
  target: PlayScreen
  /** Who the Feed and the Game's log say rolled from this screen. */
  rollerName: string
  binding: PlayBinding | null | undefined
  channel: SideFeed['channel']
}): SideFeed {
  const dispatch = usePlayRollDispatch({ target, rollerName, binding })
  const [openedAt] = useState(() => Date.now())
  const mine = usePlayRollLog().filter((roll) => roll.at >= openedAt)
  const viewerId = useViewerId()
  const entries = playFeedEntries({ rolls, alerts, events, proposals, mine, rollerName, viewerId })
  return { gameId: target.gameId, binding, channel, dispatch, entries }
}

export type PlaySide = SideFeed & {
  feed: GameFeed
  seats: ReturnType<typeof useGameBoardSources>['seats']
}

export function usePlaySide({ target, play }: PlayColumnProps): PlaySide {
  const inGame = target.gameId !== null
  const feed = useGameFeed(play.pilot)
  const sources = useGameBoardSources(target.gameId)
  const binding = usePlayChannelBinding(target)
  const side = useSideFeed({
    target,
    // The name the crew calls them by, as the Game's log and the bot's card print it.
    rollerName: pilotLabel(play.pilot),
    binding,
    // A Game's channel is its Mediator's or Organiser's to bind; solo, the player's own.
    channel: inGame
      ? {
          owner: { kind: 'game', gameName: target.gameName },
          mayBind: mayBindChannel({
            mediator: target.mediator,
            organizer: target.organizer === true,
          }),
        }
      : { owner: { kind: 'solo' }, mayBind: true },
    rolls: inGame ? feed.rolls : null,
    alerts: inGame ? feed.alerts : [],
    events: inGame ? feed.events : null,
    proposals: inGame ? feed.proposals : [],
  })
  return { ...side, feed, seats: sources.seats }
}
