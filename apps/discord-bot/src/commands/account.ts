import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { PRODUCT } from 'component-lib/product'
import { gamesCard, meCard } from '../gameCards'
import { respondWithCantina } from './cantinaReply'
import type { CommandExecuteInteraction } from './interactions'

/**
 * The two **personal** The Cantina subcommands: `/su me` and `/su games`.
 *
 * Grouped in one module rather than two because they are one idea — "what
 * does the Cantina know about *me*" — and each is a handful of lines. The
 * substantial commands (roll, lookup, sheet) keep their own files.
 *
 * Both are **ephemeral**: an account and a game list are personal, and neither
 * is something the table needs to see. Both work in any channel or a DM.
 */

export const meCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub.setName('me').setDescription(`Your ${PRODUCT.name} account and Games`)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    await respondWithCantina(interaction, {
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
    await respondWithCantina(interaction, {
      call: (client) => client.games(interaction.user.id),
      render: (value) => gamesCard(value.games),
    })
  },
}
