/**
 * /su — the bot's single top-level command; everything else is a subcommand.
 *
 * Namespacing fixes the collision problem for good: every dice bot on a
 * server registers /roll, so ours competed in the command picker on avatar
 * alone. Typing /su filters the picker to this bot, and every future
 * subcommand (encounter cards, …) lands collision-proof
 * with zero naming deliberation.
 *
 * The subcommand option shapes live with their handlers (roll.ts,
 * lookup.ts); this module only composes the builder and dispatches on
 * `getSubcommand()`. Handlers read their options identically under a
 * subcommand.
 */

import { SlashCommandBuilder } from '@discordjs/builders'
import { gamesCommand, meCommand } from './account'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'
import { lookupCommand } from './lookup'
import { rollCommand } from './roll'
import { sheetCommand } from './sheet'

export const suCommand = {
  data: new SlashCommandBuilder()
    .setName('su')
    .setDescription('Salvage Union reference tools')
    .addSubcommand((sub) => rollCommand.subcommand(sub))
    .addSubcommand((sub) => lookupCommand.subcommand(sub))
    // The Cantina (ADR-030). Always registered, never conditional
    // on configuration: a command that vanishes depending on how the bot was
    // deployed is harder to explain than one that answers that Cantina
    // is unavailable or not configured for this bot.
    .addSubcommand((sub) => meCommand.subcommand(sub))
    .addSubcommand((sub) => gamesCommand.subcommand(sub))
    .addSubcommand((sub) => sheetCommand.subcommand(sub)),

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'roll':
        return rollCommand.execute(interaction)
      case 'lookup':
        return lookupCommand.execute(interaction)
      case 'me':
        return meCommand.execute(interaction)
      case 'games':
        return gamesCommand.execute(interaction)
      case 'sheet':
        return sheetCommand.execute(interaction)
      default:
        // Unreachable while the builder above and this switch agree; loud
        // beats silent if they ever drift.
        throw new Error(`Unknown /su subcommand: ${interaction.options.getSubcommand()}`)
    }
  },

  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    switch (interaction.options.getSubcommand()) {
      case 'roll':
        return rollCommand.autocomplete(interaction)
      case 'lookup':
        return lookupCommand.autocomplete(interaction)
      case 'sheet':
        return sheetCommand.autocomplete(interaction)
      default:
        await interaction.respond([])
    }
  },
}
