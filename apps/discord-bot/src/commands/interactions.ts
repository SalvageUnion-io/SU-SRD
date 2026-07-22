/**
 * The NARROW interaction surface the command handlers actually use —
 * interface segregation over discord.js's full interaction classes.
 *
 * The real `ChatInputCommandInteraction` / `AutocompleteInteraction` satisfy
 * these structurally (the dispatcher passes them straight through), while
 * tests can build a minimal object that satisfies the same contract without
 * any forced casts. Handlers must depend on THESE types, and members are
 * added here only when a handler genuinely starts reading them.
 */

import type { InteractionReplyOptions } from 'discord.js'

/** An autocomplete choice as the handlers emit it (name + string value). */
export type CommandChoice = { name: string; value: string }

/** What `execute` handlers read off a chat-input interaction. */
export type CommandExecuteInteraction = {
  options: {
    getSubcommand(): string
    getString(name: string, required: true): string
    getString(name: string, required?: boolean): string | null
  }
  client: { user: { displayAvatarURL(): string } | null }
  reply(payload: InteractionReplyOptions): Promise<unknown>
}

/** What `autocomplete` handlers read off an autocomplete interaction. */
export type CommandAutocompleteInteraction = {
  options: {
    getSubcommand(): string
    getFocused(): string
  }
  respond(choices: CommandChoice[]): Promise<unknown>
}
