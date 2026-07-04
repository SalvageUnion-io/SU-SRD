import {
  Collection,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js'

import { suCommand } from './su.js'

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>
}

export const commands = new Collection<string, Command>()

// One top-level command; roll/lookup live under it as subcommands (see su.ts).
// deploy-commands.ts bulk-overwrites the registered set, so the retired
// standalone /roll and /lookup deregister automatically on the next deploy.
commands.set(suCommand.data.name, suCommand)
