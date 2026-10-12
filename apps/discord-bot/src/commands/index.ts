import type {
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from '@discordjs/builders'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { lookUpMessageCommand } from './lookUpMessage.js'
import { suCommand } from './su.js'

export type Command = {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder
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
// The message context menu (right-click › Apps). Discord dispatches it by
// name, like a slash command, with the target message resolved.
commands.set(lookUpMessageCommand.data.name, lookUpMessageCommand)
