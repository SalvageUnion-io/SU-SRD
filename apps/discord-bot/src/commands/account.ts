import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { PRODUCT } from 'component-lib/product'
import { gamesCard, meCard, shelfCard } from '../gameCards'
import type { CommandExecuteInteraction } from './interactions'
import { respondWithItun } from './itunReply'

/**
 * The three **personal** ITUN subcommands: `/su me`, `/su games`, `/su shelves`.
 *
 * Grouped in one module rather than three because they are one idea — "what
 * does In The Union Now know about *me*" — and each is a handful of lines. The
 * substantial commands (roll, lookup, crew) keep their own files.
 *
 * All three are **ephemeral**: an account, a game list and a shelf are personal,
 * and none of them is something the table needs to see. All three also work in
 * an unbound channel or a DM, because none of them depends on a binding.
 */

export const meCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('me').setDescription(`Your ${PRODUCT.name} account and Games`)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.me(interaction.user.id),
      render: (value) => meCard(value),
    })
  },
}

export const gamesCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('games').setDescription('Every Game you belong to')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.games(interaction.user.id),
      render: (value) => gamesCard(value.games),
    })
  },
}

export const shelfCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('shelves').setDescription('Your pilots and mechs on your shelf, in no Game')
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithItun(interaction, {
      call: (client) => client.shelf(interaction.user.id),
      render: (value) => shelfCard(value),
    })
  },
}
