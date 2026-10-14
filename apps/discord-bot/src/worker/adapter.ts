/**
 * Adapts a raw Discord interaction payload to the narrow structural types the
 * command handlers already depend on (`commands/interactions.ts`).
 *
 * ## Why there is an adapter at all, and why it is small
 *
 * `commands/interactions.ts` is interface-segregated: handlers depend on the
 * four or five members they actually read, so this file only has to supply
 * those, and tests can fake them without a Discord client.
 *
 * ## The response model, which is the whole problem
 *
 * Over HTTP interactions, the FIRST response is the body of the request
 * Discord is still holding open, and everything after it is a webhook call.
 * Discord gives 3 seconds for that first response.
 *
 * So a handler's first `reply()` or `deferReply()` has to become the HTTP
 * response, and any later `editReply()` / `followUp()` has to become REST. That
 * is what `ResponseSink` below does: it resolves a promise the moment the
 * handler produces its first response, letting the Worker answer immediately
 * while the rest of the handler keeps running under `ctx.waitUntil`.
 *
 * Deliberately NOT "always defer". Deferring shows a "thinking…" state, and the
 * roll commands answer in microseconds — making every one of them flicker
 * through a spinner would be a visible regression to pay for an implementation
 * convenience.
 */

import type { REST } from '@discordjs/rest'
import type {
  APIApplicationCommandInteractionDataBasicOption,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataSubcommandGroupOption,
  APIApplicationCommandInteractionDataSubcommandOption,
  APIInteraction,
} from 'discord-api-types/v10'
import {
  ApplicationCommandOptionType,
  InteractionResponseType,
  Routes,
} from 'discord-api-types/v10'
import type {
  CommandAutocompleteInteraction,
  CommandButtonInteraction,
  CommandChoice,
  CommandExecuteInteraction,
} from '../commands/interactions'

/** What the Worker returns to Discord as the initial response. */
export type InitialResponse = { type: number; data?: unknown }

/**
 * Captures a handler's first response and hands it to the Worker.
 *
 * The handler keeps running after this resolves — that is the point. Later
 * calls go over REST instead, and `settled` tells the adapter which path a
 * given call is on.
 */
export class ResponseSink {
  private resolveFirst!: (r: InitialResponse) => void
  readonly first: Promise<InitialResponse>
  settled = false

  constructor() {
    this.first = new Promise<InitialResponse>((resolve) => {
      this.resolveFirst = resolve
    })
  }

  send(response: InitialResponse): void {
    if (this.settled) return
    this.settled = true
    this.resolveFirst(response)
  }
}

/**
 * The option list for the innermost subcommand.
 *
 * Discord nests options: a subcommand group holds subcommands, which hold the
 * actual values. `/su roll table:…` therefore arrives as
 * `[{type: SUB_COMMAND, name: 'roll', options: [{name: 'table', ...}]}]`, and a
 * naive read of the top level finds no `table` at all.
 */
function resolveOptionPath(options: APIApplicationCommandInteractionDataOption[] | undefined): {
  group: string | null
  subcommand: string | null
  values: APIApplicationCommandInteractionDataBasicOption[]
} {
  let group: string | null = null
  let subcommand: string | null = null
  let current = options ?? []

  const first = current[0]
  if (first?.type === ApplicationCommandOptionType.SubcommandGroup) {
    group = first.name
    current = (first as APIApplicationCommandInteractionDataSubcommandGroupOption).options ?? []
  }

  const next = current[0]
  if (next?.type === ApplicationCommandOptionType.Subcommand) {
    subcommand = next.name
    current = (next as APIApplicationCommandInteractionDataSubcommandOption).options ?? []
  }

  return { group, subcommand, values: current as APIApplicationCommandInteractionDataBasicOption[] }
}

/**
 * Read a string option, throwing on the required case.
 *
 * The overload in `commands/interactions.ts` types `getString(name, true)` as
 * `string`, not `string | null` — so returning null there is a type lie that
 * becomes a `TypeError` deep inside a handler which was told it had a string.
 * So this throws instead: the dispatcher catches it and
 * replies with the generic error, which is a far better outcome than
 * `null is not an object` at some unrelated line.
 */
function stringOption(
  values: APIApplicationCommandInteractionDataBasicOption[],
  name: string,
  required?: boolean
): string | null {
  const found = values.find((o) => o.name === name)
  if (!found || found.type !== ApplicationCommandOptionType.String) {
    if (required === true) {
      throw new Error(`Required string option "${name}" was not present on the interaction`)
    }
    return null
  }
  return found.value
}

/**
 * A boolean option, or null when it was not supplied.
 *
 * Never throws: unlike `getString`, no handler declares a boolean required — a
 * flag that must be passed is not a flag.
 */
function booleanOption(
  values: APIApplicationCommandInteractionDataBasicOption[],
  name: string
): boolean | null {
  const found = values.find((o) => o.name === name)
  if (!found || found.type !== ApplicationCommandOptionType.Boolean) return null
  return found.value
}

type AdapterContext = {
  raw: APIInteraction
  applicationId: string
  rest: REST
  sink: ResponseSink
}

/**
 * REST helpers for everything after the first response.
 *
 * `editReply` targets `@original` — the message the initial response created
 * (or promised, when deferred). `followUp` posts a NEW message on the same
 * interaction token. Both use the interaction token rather than the bot token,
 * which is why they work for 15 minutes and then stop.
 */
export function webhookRoutes(applicationId: string, token: string) {
  return {
    original: Routes.webhookMessage(applicationId, token, '@original'),
    followUp: Routes.webhook(applicationId, token),
  }
}

/**
 * What to call the person who rolled, in Discord's own order of preference:
 * a per-guild nickname, then the account's display name, then the username.
 *
 * Naming the roller is why this exists. Discord's own "used /su roll" header
 * covers a slash command, but a **button** re-roll attributes far more weakly —
 * and "who got the 20?" is the most-asked question at a busy table.
 */
function displayNameOf(raw: RawActor): string | undefined {
  const user = raw.member?.user ?? raw.user
  return raw.member?.nick ?? user?.global_name ?? user?.username ?? undefined
}

/** The fields of a raw interaction that say who sent it, and where. */
type RawActor = {
  channel_id?: string | null
  member?: {
    nick?: string | null
    user?: { id: string; global_name?: string | null; username?: string }
  }
  user?: { id: string; global_name?: string | null; username?: string }
}

/**
 * Who ran an interaction.
 *
 * `user` is top-level in DMs and nested under `member` in a guild. Reading
 * only one of them is how a command works everywhere except where it is
 * actually used.
 */
function actorOf(raw: RawActor): Pick<CommandExecuteInteraction, 'user'> {
  return {
    user: { id: raw.member?.user?.id ?? raw.user?.id ?? '', displayName: displayNameOf(raw) },
  }
}

function replyMembers(ctx: AdapterContext) {
  const token = (ctx.raw as { token: string }).token
  const routes = webhookRoutes(ctx.applicationId, token)

  return {
    async reply(payload: unknown): Promise<unknown> {
      // Before the first response this IS the HTTP response. After it — which
      // happens when an error handler replies on an already-answered
      // interaction — it has to become a follow-up, or it would be silently
      // dropped.
      //
      // Payloads carry builder instances (`ContainerBuilder`) as they are;
      // `JSON.stringify` — the Worker's for the initial response, the REST
      // client's for everything after — calls their `toJSON()`.
      if (!ctx.sink.settled) {
        ctx.sink.send({ type: InteractionResponseType.ChannelMessageWithSource, data: payload })
        return undefined
      }
      return ctx.rest.post(routes.followUp, { body: payload })
    },

    async deferReply(options?: { flags?: number }): Promise<unknown> {
      ctx.sink.send({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: options?.flags === undefined ? undefined : { flags: options.flags },
      })
      return undefined
    },

    async editReply(payload: unknown): Promise<unknown> {
      return ctx.rest.patch(routes.original, { body: payload })
    },

    async followUp(payload: unknown): Promise<unknown> {
      return ctx.rest.post(routes.followUp, { body: payload })
    },
  }
}

/**
 * The message a message context-menu command was used on: Discord sends it
 * whole under `resolved.messages`, keyed by `target_id`. Null for a slash
 * command, which has no target.
 */
type RawTarget = {
  target_id?: string
  resolved?: {
    messages?: Record<
      string,
      { content?: string; author?: { global_name?: string | null; username?: string } }
    >
  }
}

function targetMessageOf(data: RawTarget | undefined): { content: string; author?: string } | null {
  const id = data?.target_id
  const message = id ? data?.resolved?.messages?.[id] : undefined
  if (!message) return null
  const author = message.author?.global_name ?? message.author?.username
  return { content: message.content ?? '', ...(author ? { author } : {}) }
}

/**
 * The command an interaction ran, for the one usage log line per interaction:
 * `su sheet` for a command or its autocomplete, `su:roll` for
 * a button. Never a user id, an option value or a button payload.
 */
export function interactionName(raw: APIInteraction): string | null {
  const data = (raw as { data?: { name?: string; custom_id?: string } }).data
  if (data?.custom_id !== undefined) return data.custom_id.split(':').slice(0, 2).join(':')
  if (data?.name === undefined) return null
  const { group, subcommand } = resolveOptionPath(
    (data as { options?: APIApplicationCommandInteractionDataOption[] }).options
  )
  return [data.name, group, subcommand].filter((part) => part !== null).join(' ')
}

/** Build the chat-input surface `Command.execute` expects. */
export function makeExecuteInteraction(ctx: AdapterContext): CommandExecuteInteraction {
  const raw = ctx.raw as RawActor & {
    data?: { options?: APIApplicationCommandInteractionDataOption[] } & RawTarget
  }
  const { group, subcommand, values } = resolveOptionPath(raw.data?.options)

  return {
    options: {
      getSubcommand: () => subcommand ?? '',
      getSubcommandGroup: () => group,
      // Overloaded in the source type (required: true narrows to string). One
      // implementation satisfies both; the cast is at the boundary only.
      // `required` must be forwarded, or a required option comes back null to a
      // handler typed to receive a string.
      getString: ((name: string, required?: boolean) =>
        stringOption(values, name, required)) as CommandExecuteInteraction['options']['getString'],
      getBoolean: (name: string) => booleanOption(values, name),
    },
    ...actorOf(raw),
    targetMessage: targetMessageOf(raw.data),
    ...replyMembers(ctx),
  } as CommandExecuteInteraction
}

/** Build the component surface (a button or a menu) `handleButtonInteraction` expects. */
export function makeButtonInteraction(ctx: AdapterContext): CommandButtonInteraction {
  const raw = ctx.raw as RawActor & { data?: { custom_id?: string; values?: string[] } }

  return {
    customId: raw.data?.custom_id ?? '',
    values: raw.data?.values ?? [],
    ...actorOf(raw),
    ...replyMembers(ctx),
  } as CommandButtonInteraction
}

/**
 * Build the autocomplete surface.
 *
 * Autocomplete CANNOT be deferred — Discord expects the choices in the initial
 * response — so `respond` always settles the sink and never touches REST.
 */
export function makeAutocompleteInteraction(ctx: AdapterContext): CommandAutocompleteInteraction {
  const raw = ctx.raw as RawActor & {
    data?: { options?: APIApplicationCommandInteractionDataOption[] }
  }
  const { group, subcommand, values } = resolveOptionPath(raw.data?.options)
  const focused = values.find((o) => (o as { focused?: boolean }).focused === true)

  return {
    options: {
      getSubcommand: () => subcommand ?? '',
      getSubcommandGroup: () => group,
      getFocused: () =>
        focused && focused.type === ApplicationCommandOptionType.String ? focused.value : '',
    },
    ...actorOf(raw),
    async respond(choices: CommandChoice[]): Promise<unknown> {
      ctx.sink.send({
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: { choices },
      })
      return undefined
    },
  }
}
