/**
 * /su — the bot's single top-level command; everything else is a subcommand.
 *
 * Namespacing fixes the collision problem for good: every dice bot on a
 * server registers /roll, so ours competed in the command picker on avatar
 * alone. Typing /su filters the picker to this bot, and every future
 * subcommand (encounter cards, snapshot lookups, …) lands collision-proof
 * with zero naming deliberation.
 *
 * The subcommand option shapes live with their handlers (roll.ts,
 * lookup.ts); this module only composes the builder and dispatches on
 * `getSubcommand()`. Handlers read their options identically under a
 * subcommand, so their logic and tests are untouched.
 */

import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js'

import { checkCommand } from './check.js'
import { lookupCommand } from './lookup.js'
import { rollCommand } from './roll.js'

export const suCommand = {
  data: new SlashCommandBuilder()
    .setName('su')
    .setDescription('Salvage Union reference tools')
    .addSubcommand((sub) => rollCommand.subcommand(sub))
    .addSubcommand((sub) => checkCommand.subcommand(sub))
    .addSubcommand((sub) => lookupCommand.subcommand(sub)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'roll':
        return rollCommand.execute(interaction)
      case 'check':
        return checkCommand.execute(interaction)
      case 'lookup':
        return lookupCommand.execute(interaction)
      default:
        // Unreachable while the builder above and this switch agree; loud
        // beats silent if they ever drift.
        throw new Error(`Unknown /su subcommand: ${interaction.options.getSubcommand()}`)
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'roll':
        return rollCommand.autocomplete(interaction)
      case 'lookup':
        return lookupCommand.autocomplete(interaction)
      default:
        await interaction.respond([])
    }
  },
}
