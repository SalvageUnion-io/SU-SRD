/**
 * Play's Discord channels as the screens read them (play.md §9), pure: whose a
 * channel is, a Game's channel chip on the landing (`channelBindings.mine`)
 * and what the Post toggle says. A channel is named as it was when bound (`#salvage-run`); a
 * binding made before names were kept is named by whose it is.
 */

/** A bound channel as the web reads it (`channelBindings.current`, `.mine`). */
export type PlayBinding = {
  channelId: string
  /** The channel's name when bound (no `#`); null where it was never kept. */
  channelName: string | null
  boundAt: number
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
 * The Play bar's channel button: Connect with nothing bound, else the
 * channel's name, or whose it is where the name was never kept.
 */
export function channelButtonLabel(
  owner: ChannelOwner,
  binding: PlayBinding | null | undefined
): string {
  if (binding == null) return 'Connect'
  return channelTag(binding) ?? (owner.kind === 'solo' ? '# My channel' : '# Game channel')
}

/** What the Post toggle says it does: "Post rolls to #salvage-run", or whose channel. */
export function postLabel(solo: boolean, binding?: PlayBinding | null): string {
  const tag = channelTag(binding)
  if (tag !== null) return `Post rolls to ${tag}`
  return solo ? 'Post rolls to my channel' : 'Post rolls to the Game’s channel'
}
