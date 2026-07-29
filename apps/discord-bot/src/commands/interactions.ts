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

import type { InteractionEditReplyOptions, InteractionReplyOptions, MessageFlags } from 'discord.js'

/** An autocomplete choice as the handlers emit it (name + string value). */
export type CommandChoice = { name: string; value: string }

/**
 * What `execute` handlers read off a chat-input interaction.
 *
 * `user`, `channelId` and the defer/edit pair were added for the ITUN Game
 * commands (ADR-030 Phase 6): the Discord user id IS the account key, the
 * channel decides which Game a command speaks for, and a round trip to Convex
 * does not reliably fit inside Discord's 3-second acknowledgement window, so
 * every Game subcommand defers first.
 *
 * `getSubcommandGroup` arrived with `/su game …`, the first subcommand group.
 */
export type CommandExecuteInteraction = {
  options: {
    getSubcommand(): string
    getSubcommandGroup(): string | null
    getString(name: string, required: true): string
    getString(name: string, required?: boolean): string | null
  }
  client: { user: { displayAvatarURL(): string } | null }
  user: { id: string }
  channelId: string | null
  reply(payload: InteractionReplyOptions): Promise<unknown>
  deferReply(options?: { flags?: MessageFlags.Ephemeral }): Promise<unknown>
  editReply(payload: InteractionEditReplyOptions): Promise<unknown>
  followUp(payload: InteractionReplyOptions): Promise<unknown>
}

/** What `autocomplete` handlers read off an autocomplete interaction. */
export type CommandAutocompleteInteraction = {
  options: {
    getSubcommand(): string
    getSubcommandGroup(): string | null
    getFocused(): string
  }
  user: { id: string }
  channelId: string | null
  respond(choices: CommandChoice[]): Promise<unknown>
}
