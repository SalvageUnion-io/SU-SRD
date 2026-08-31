/**
 * Adapts a raw Discord interaction payload to the narrow structural types the
 * command handlers already depend on (`commands/interactions.ts`).
 *
 * ## Why there is an adapter at all, and why it is small
 *
 * `commands/interactions.ts` was written to be interface-segregated: handlers
 * depend on the four or five members they actually read, and `discord.js`'s
 * classes satisfy that structurally. That decision — made for testability, long
 * before Cloudflare was on the table — is what makes this file an adapter
 * rather than a rewrite. Nothing in `commands/` changes.
 *
 * ## The response model, which is the whole problem
 *
 * Over the gateway, `reply()` is just an HTTP call and the handler can take as
 * long as it likes. Over HTTP interactions, the FIRST response is the body of
 * the request Discord is still holding open, and everything after it is a
 * webhook call. Discord gives 3 seconds for that first response.
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
} from '../commands/interactions.js'

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
  /** True once the handler deferred — later edits target @original. */
  deferred = false

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
 * Read a string option, matching discord.js's behaviour on the required case.
 *
 * The overload in `commands/interactions.ts` types `getString(name, true)` as
 * `string`, not `string | null` — so returning null there is a type lie that
 * becomes a `TypeError` deep inside a handler which was told it had a string.
 * discord.js throws instead, and so must this: the dispatcher catches it and
 * replies with the generic error, which is a far better outcome than
 * `null is not an object` at some unrelated line.
 *
 * Found by driving `/su lookup` through the replay harness with the wrong
 * option name — the adapter handed the handler a null and the failure surfaced
 * five frames away in `findByChoiceValue`.
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

/** The bot's own avatar URL, derived from the ids Discord sends. */
function botAvatarURL(applicationId: string, avatarHash: string | null | undefined): string | null {
  if (!avatarHash) return null
  return `https://cdn.discordapp.com/avatars/${applicationId}/${avatarHash}.png`
}

type AdapterContext = {
  raw: APIInteraction
  applicationId: string
  /** Bot avatar hash, if known. Handlers tolerate a null icon. */
  botAvatarHash?: string | null
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

/** Strip builder instances down to the JSON the REST API accepts. */
function toPlainPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') return payload
  const source = payload as Record<string, unknown> & { toJSON?: () => unknown }
  if (typeof source.toJSON === 'function') return source.toJSON()

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    out[key] = Array.isArray(value) ? value.map((v) => toPlainPayload(v)) : toPlainPayload(value)
  }
  return out
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
      if (!ctx.sink.settled) {
        ctx.sink.send({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: toPlainPayload(payload),
        })
        return undefined
      }
      return ctx.rest.post(routes.followUp, { body: toPlainPayload(payload) })
    },

    async deferReply(options?: { flags?: number }): Promise<unknown> {
      ctx.sink.deferred = true
      ctx.sink.send({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: options?.flags === undefined ? undefined : { flags: options.flags },
      })
      return undefined
    },

    async editReply(payload: unknown): Promise<unknown> {
      return ctx.rest.patch(routes.original, { body: toPlainPayload(payload) })
    },

    async followUp(payload: unknown): Promise<unknown> {
      return ctx.rest.post(routes.followUp, { body: toPlainPayload(payload) })
    },
  }
}

/** Build the chat-input surface `Command.execute` expects. */
export function makeExecuteInteraction(ctx: AdapterContext): CommandExecuteInteraction {
  const raw = ctx.raw as {
    data?: { options?: APIApplicationCommandInteractionDataOption[] }
    channel_id?: string | null
    member?: { user?: { id: string } }
    user?: { id: string }
  }
  const { group, subcommand, values } = resolveOptionPath(raw.data?.options)
  const iconURL = botAvatarURL(ctx.applicationId, ctx.botAvatarHash)

  return {
    options: {
      getSubcommand: () => subcommand ?? '',
      getSubcommandGroup: () => group,
      // Overloaded in the source type (required: true narrows to string). One
      // implementation satisfies both; the cast is at the boundary only.
      // `required` must be forwarded — dropping it is what let a null reach a
      // handler typed to receive a string.
      getString: ((name: string, required?: boolean) =>
        stringOption(values, name, required)) as CommandExecuteInteraction['options']['getString'],
    },
    // `user` is top-level in DMs and nested under `member` in a guild. Reading
    // only one of them is how a command works everywhere except where it is
    // actually used.
    user: { id: raw.member?.user?.id ?? raw.user?.id ?? '' },
    channelId: raw.channel_id ?? null,
    client: { user: iconURL ? { displayAvatarURL: () => iconURL } : null },
    ...replyMembers(ctx),
  } as CommandExecuteInteraction
}

/** Build the button surface `handleButtonInteraction` expects. */
export function makeButtonInteraction(ctx: AdapterContext): CommandButtonInteraction {
  const raw = ctx.raw as {
    data?: { custom_id?: string }
    channel_id?: string | null
    member?: { user?: { id: string } }
    user?: { id: string }
  }
  const iconURL = botAvatarURL(ctx.applicationId, ctx.botAvatarHash)

  return {
    customId: raw.data?.custom_id ?? '',
    user: { id: raw.member?.user?.id ?? raw.user?.id ?? '' },
    channelId: raw.channel_id ?? null,
    client: { user: iconURL ? { displayAvatarURL: () => iconURL } : null },
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
  const raw = ctx.raw as {
    data?: { options?: APIApplicationCommandInteractionDataOption[] }
    channel_id?: string | null
    member?: { user?: { id: string } }
    user?: { id: string }
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
    user: { id: raw.member?.user?.id ?? raw.user?.id ?? '' },
    channelId: raw.channel_id ?? null,
    async respond(choices: CommandChoice[]): Promise<unknown> {
      ctx.sink.send({
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: { choices },
      })
      return undefined
    },
  }
}
