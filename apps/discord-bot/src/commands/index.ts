import type {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from '@discordjs/builders'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { suCommand } from './su.js'

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
  execute: (interaction: CommandExecuteInteraction) => Promise<void>
  autocomplete?: (interaction: CommandAutocompleteInteraction) => Promise<void>
}

/**
 * The registered commands, keyed by name.
 *
 * A plain `Map`: the Worker only ever calls `get`, and `deploy-commands.ts`
 * only `values()`.
 */
export const commands = new Map<string, Command>()

// One top-level command; roll/lookup live under it as subcommands (see su.ts).
// deploy-commands.ts bulk-overwrites the registered set, so a command removed
// here deregisters on the next deploy.
commands.set(suCommand.data.name, suCommand)
