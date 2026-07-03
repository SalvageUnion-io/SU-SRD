import {
  Collection,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js'

import { lookupCommand } from './lookup.js'
import { rollCommand } from './roll.js'

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>
}

export const commands = new Collection<string, Command>()

// Register all commands
commands.set(rollCommand.data.name, rollCommand)
commands.set(lookupCommand.data.name, lookupCommand)
