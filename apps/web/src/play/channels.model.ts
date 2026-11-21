/**
 * Play's Discord channels as the screens read them (play.md §9), pure: whose a
 * channel is, a Game's channel chip on the landing (`channelBindings.mine`)
 * and where the Tables say rolls post. A channel is named as it was when bound (`#salvage-run`); a
 * binding made before names were kept is named by whose it is.
 */

import { playCopy } from '../messages/play'

/** A bound channel as the web reads it (`channelBindings.current`, `.mine`). */
export type PlayBinding = {
  channelId: string
  /** The channel's name when bound (no `#`); null where it was never kept. */
  channelName: string | null
  boundAt: number
  /** In a Game with no channel bound: my own channel, which my rolls post to instead. */
  own?: true
}

/** Whose channel: a Game's (by name), or my own for solo play. */
export type ChannelOwner = { kind: 'game'; gameName: string | null } | { kind: 'solo' }

/** What `channelBindings.mine` answers. */
export type MyChannels = {
  personal: PlayBinding | null
  games: { gameId: string; gameName: string; mayBind: boolean; binding: PlayBinding | null }[]
}

/** A bound channel by its name, `#salvage-run`; null with no binding or no kept name. */
export function channelTag(binding: PlayBinding | null | undefined): string | null {
  return binding?.channelName ? `#${binding.channelName}` : null
}

/**
 * The Play bar's channel button: the channel's name, or whose it is where the
 * name was never kept. With nothing bound there is no button (the ⋯'s
 * "Discord channel" row, for whoever may bind one).
 */
export function channelButtonLabel(
  owner: ChannelOwner,
  binding: PlayBinding | null | undefined
): string {
  if (binding == null) return playCopy('discordChannel')
  return (
    channelTag(binding) ??
    (owner.kind === 'solo' || binding.own ? playCopy('myChannelTag') : playCopy('gameChannelTag'))
  )
}

/**
 * The Rolls pane's "Discord channel" row: where rolls post, or that nothing is
 * bound and who can change that.
 */
export function channelState(solo: boolean, binding: PlayBinding | null, mayBind: boolean): string {
  if (binding !== null) return postsToLabel(solo, binding)
  return mayBind ? playCopy('channelNoneBound') : playCopy('channelNoneBoundPlayer')
}

/** Where the screen's rolls post: "Rolls post to #salvage-run", or whose channel. */
export function postsToLabel(solo: boolean, binding?: PlayBinding | null): string {
  const tag = channelTag(binding)
  if (tag !== null) return playCopy('rollsPostTo', { tag })
  return solo || binding?.own
    ? playCopy('rollsPostToMyChannel')
    : playCopy('rollsPostToTheGamesChannel')
}
