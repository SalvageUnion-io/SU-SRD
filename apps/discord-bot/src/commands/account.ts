import type { SlashCommandSubcommandBuilder } from 'discord.js'
import { config } from '../config.js'
import { buildGamesEmbed, buildMeEmbed, buildShelfEmbed } from '../gameEmbed.js'
import type { CommandExecuteInteraction } from './interactions.js'
import { respondWithItun } from './itunReply.js'

/**
 * The three **personal** ITUN subcommands: `/su me`, `/su games`, `/su shelf`.
 *
 * Grouped in one module rather than three because they are one idea — "what
 * does In The Union Now know about *me*" — and each is a handful of lines. The
 * substantial commands (roll, check, lookup, crew) keep their own files.
 *
 * All three are **ephemeral**: an account, a game list and a shelf are personal,
 * and none of them is something the table needs to see. All three also work in
 * an unbound channel or a DM, because none of them depends on a binding.
 */

export const meCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('me').setDescription('Your In The Union Now account and games')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.me(interaction.user.id),
      // `currentGameId` is deliberately not resolved here: it would cost a
      // second round trip to mark one line, and `/su game info` answers
      // "what is this channel" properly.
      render: (value) => buildMeEmbed(value, config.itunWebUrl),
    })
  },
}

export const gamesCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('games').setDescription('Every game you belong to')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.games(interaction.user.id),
      render: (value) => buildGamesEmbed(value.games, config.itunWebUrl),
    })
  },
}

export const shelfCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('shelf').setDescription('Your pilots and mechs that are not in play')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.shelf(interaction.user.id),
      render: (value) => buildShelfEmbed(value, config.itunWebUrl),
    })
  },
}
