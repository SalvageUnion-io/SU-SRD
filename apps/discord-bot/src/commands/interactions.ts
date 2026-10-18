/**
 * The NARROW interaction surface the command handlers actually use.
 *
 * `worker/adapter.ts` builds these objects from Discord's raw `APIInteraction`
 * (`makeExecuteInteraction`, `makeAutocompleteInteraction`), and tests fake
 * them in `__tests__/fakeInteraction.ts` without any forced casts. Handlers
 * must depend on THESE types, and members are added here only when a handler
 * genuinely starts reading them.
 */

import type { APIMessageTopLevelComponent, MessageFlags } from 'discord-api-types/v10'

/**
 * A top-level message component, either raw or as a builder.
 *
 * `@discordjs/builders`' `ContainerBuilder` / `ActionRowBuilder` satisfy this
 * through `toJSON()`, which `JSON.stringify` calls when the payload goes over
 * the wire (`worker/adapter.ts`).
 */
type ReplyComponent = APIMessageTopLevelComponent | { toJSON(): APIMessageTopLevelComponent }

/**
 * What a handler may send as a reply or follow-up.
 *
 * These are the only three keys any handler sets. There is no `embeds`:
 * every reply is Components V2, which forbids them.
 */
type ReplyPayload = {
  content?: string
  components?: readonly ReplyComponent[]
  flags?: number
}

/** An edit may also clear the content, which a fresh reply cannot. */
type EditReplyPayload = Omit<ReplyPayload, 'content'> & { content?: string | null }

/** An autocomplete choice as the handlers emit it (name + string value). */
export type CommandChoice = { name: string; value: string }

/**
 * What `execute` handlers read off a chat-input interaction.
 *
 * For `/su sheet` (ADR-030): the Discord user id (`user`) IS the account key,
 * and a round trip to Convex does not reliably fit inside Discord's 3-second
 * acknowledgement window, so it defers first (the defer/edit pair).
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
  /**
   * The channel the command ran in (`/su bind` binds it), or null when Discord
   * sent none.
   */
  channelId: string | null
  /**
   * That channel's name (`salvage-run`), which `/su bind` keeps beside its id
   * so Play can show it; null when Discord sent no channel object (a DM).
   */
  channelName: string | null
  /**
   * The message a message context-menu command was used on, or null for a
   * slash command.
   */
  targetMessage: { content: string; author?: string } | null
  reply(payload: ReplyPayload): Promise<unknown>
  deferReply(options?: { flags?: MessageFlags.Ephemeral }): Promise<unknown>
  editReply(payload: EditReplyPayload): Promise<unknown>
  followUp(payload: ReplyPayload): Promise<unknown>
}

/**
 * What the button router reads off a message-component interaction (a button,
 * or the lookup card's linked-entries menu).
 *
 * Narrow for the same reason the command surfaces are: `worker/adapter.ts`
 * (`makeButtonInteraction`) builds it from the raw message-component
 * interaction, while a test builds the members it actually uses with no cast.
 */
export type CommandButtonInteraction = {
  customId: string
  /** A select menu's picked option values; empty for a button. */
  values: readonly string[]
  user: { id: string; displayName?: string }
  reply(payload: ReplyPayload): Promise<unknown>
}

/** What `autocomplete` handlers read off an autocomplete interaction. */
export type CommandAutocompleteInteraction = {
  options: {
    getSubcommand(): string
    getSubcommandGroup(): string | null
    getFocused(): string
  }
  user: { id: string; displayName?: string }
  respond(choices: CommandChoice[]): Promise<unknown>
}
