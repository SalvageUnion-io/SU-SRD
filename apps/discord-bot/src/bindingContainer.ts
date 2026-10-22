/**
 * The `/su bind` and `/su unbind` replies, as Components V2 containers.
 *
 * Neither is an entity, so they author their own blocks: a headline saying
 * what is now true of the channel, and a line saying what that means for
 * rolls. Pure: a server result in, container data out.
 */

import { DISCORD_NEUTRAL_ACCENT } from 'salvageunion-reference'
import type { ContainerData } from './container'
import type { BindChannelResult, ChannelBindingSummary, UnbindChannelResult } from './play/types'

/** A channel as Discord renders a link to it. */
function channelMention(channelId: string): string {
  return `<#${channelId}>`
}

/** What a binding posts: one Game's rolls, or one person's solo rolls. */
function whose(binding: ChannelBindingSummary): string {
  return binding.gameId === null ? 'your solo play' : `**${binding.gameName ?? 'your Game'}**`
}

export function boundContainer(result: BindChannelResult): ContainerData {
  const { binding, previousChannelId } = result
  const lines = [
    binding.gameId === null
      ? 'Rolls you make in Play outside a Game post here.'
      : 'Rolls made in Play in this Game post here, unless the roller keeps one private.',
  ]
  if (previousChannelId !== null && previousChannelId !== binding.channelId) {
    lines.push(`-# Moved from ${channelMention(previousChannelId)}, which no longer receives them.`)
  }
  return {
    accent: DISCORD_NEUTRAL_ACCENT,
    blocks: [
      {
        kind: 'text',
        content: `## ${channelMention(binding.channelId)} is bound to ${whose(binding)}`,
      },
      { kind: 'text', content: lines.join('\n') },
      { kind: 'text', content: '-# `/su unbind` here stops it.' },
    ],
  }
}

export function unboundContainer(result: UnbindChannelResult, channelId: string): ContainerData {
  if (result.unbound === null) {
    return {
      accent: DISCORD_NEUTRAL_ACCENT,
      blocks: [
        { kind: 'text', content: `## ${channelMention(channelId)} was not bound` },
        { kind: 'text', content: 'No rolls post here. `/su bind` binds it.' },
      ],
    }
  }
  return {
    accent: DISCORD_NEUTRAL_ACCENT,
    blocks: [
      {
        kind: 'text',
        content: `## ${channelMention(channelId)} is no longer bound to ${whose(result.unbound)}`,
      },
      { kind: 'text', content: 'Rolls stop posting here.' },
    ],
  }
}
