import type {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'
import { Collection } from 'discord.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { suCommand } from './su.js'

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
  execute: (interaction: CommandExecuteInteraction) => Promise<void>
  autocomplete?: (interaction: CommandAutocompleteInteraction) => Promise<void>
}

export const commands = new Collection<string, Command>()

// One top-level command; roll/lookup live under it as subcommands (see su.ts).
// deploy-commands.ts bulk-overwrites the registered set, so the retired
// standalone /roll and /lookup deregister automatically on the next deploy.
commands.set(suCommand.data.name, suCommand)
