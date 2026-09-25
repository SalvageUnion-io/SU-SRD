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

import type { APIMessageTopLevelComponent, MessageFlags } from 'discord-api-types/v10'

/**
 * A top-level message component, either raw or as a builder.
 *
 * `@discordjs/builders`' `ContainerBuilder` / `ActionRowBuilder` satisfy this
 * through `toJSON()`, which is exactly what the HTTP adapter calls before the
 * payload goes over the wire (`http/adapter.ts`, `toPlainPayload`).
 */
export type ReplyComponent = APIMessageTopLevelComponent | { toJSON(): APIMessageTopLevelComponent }

/**
 * What a handler may send as a reply or follow-up.
 *
 * Local rather than `discord.js`'s `InteractionReplyOptions`: the bot is an
 * HTTP-interactions Worker and has no `discord.js` dependency at all, and these
 * are the only three keys any handler sets. There is deliberately no `embeds`
 * — every surface moved to Components V2, which forbids them.
 */
export type ReplyPayload = {
  content?: string
  components?: readonly ReplyComponent[]
  flags?: number
}

/** An edit may also clear the content, which a fresh reply cannot. */
export type EditReplyPayload = Omit<ReplyPayload, 'content'> & { content?: string | null }

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
    getBoolean(name: string): boolean | null
  }
  user: { id: string; displayName?: string }
  channelId: string | null
  reply(payload: ReplyPayload): Promise<unknown>
  deferReply(options?: { flags?: MessageFlags.Ephemeral }): Promise<unknown>
  editReply(payload: EditReplyPayload): Promise<unknown>
  followUp(payload: ReplyPayload): Promise<unknown>
}

/**
 * What the button router reads off a message-component interaction.
 *
 * Narrow for the same reason the command surfaces are: discord.js's
 * `ButtonInteraction` satisfies this structurally, so the dispatcher passes one
 * straight through, while a test builds the four members it actually uses with
 * no cast. `user`/`channelId`/`editReply` are here because a re-roll is a roll
 * and is attributed exactly like a slash-command one.
 */
export type CommandButtonInteraction = {
  customId: string
  user: { id: string; displayName?: string }
  channelId: string | null
  reply(payload: ReplyPayload): Promise<unknown>
  editReply(payload: EditReplyPayload): Promise<unknown>
}

/** What `autocomplete` handlers read off an autocomplete interaction. */
export type CommandAutocompleteInteraction = {
  options: {
    getSubcommand(): string
    getSubcommandGroup(): string | null
    getFocused(): string
  }
  user: { id: string; displayName?: string }
  channelId: string | null
  respond(choices: CommandChoice[]): Promise<unknown>
}
