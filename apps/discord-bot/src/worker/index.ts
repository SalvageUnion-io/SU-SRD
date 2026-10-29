/**
 * Cloudflare Worker entrypoint for Discord HTTP interactions (ADR-033 §1).
 *
 * This is the bot's only transport. `commands/` depends on the narrow
 * structural types in `commands/interactions.ts`, which `./adapter.ts` builds
 * from the raw interaction payload.
 *
 * Discord routes interactions here because the application's Interactions
 * Endpoint URL points at this Worker. That setting is application-wide, so
 * there is no canary and no test guild — which is why the replay harness in
 * `__tests__/` is the gate rather than a staged rollout.
 *
 * ## Four workerd constraints this file exists to respect
 *
 * Measured on real workerd, not inferred:
 *
 *   1. **Module scope forbids timers, async I/O and randomness.** `new REST()`
 *      registers sweeper timers and throws outright with *"Disallowed operation
 *      called within global scope"*. It is therefore constructed per request.
 *      The same rule is why observability init is not hoisted here.
 *   2. **Top-level `await` works**, so `preload('all')` runs once per isolate at
 *      startup — charged against the 1 s startup budget (measured 141 ms by
 *      Cloudflare) rather than the 10 ms per-request CPU budget. Moving it into
 *      the request path would break the bot on the Free plan.
 *   3. **Zod's `jitless` config is load-bearing**, not just a CSP nicety: Zod's
 *      JIT parser compiles validators with `new Function`, which workerd bans.
 *      `packages/salvageunion-reference/lib/zod.ts` already sets it.
 *   4. **`Date.now()` is frozen between I/O**, so nothing here tries to measure
 *      its own CPU time. Read `cpuTime` from `wrangler tail` instead.
 */

import { REST } from '@discordjs/rest'
import type { APIInteraction } from 'discord-api-types/v10'
import { InteractionResponseType, InteractionType, MessageFlags } from 'discord-api-types/v10'

export { Relay } from './relay'

import { SalvageUnionReference } from 'salvageunion-reference'
import { handleButtonInteraction } from '../buttons'
import { commands } from '../commands/index'
import { setSiteClient, site } from '../commands/siteReply'
import { v2Reply } from '../container'
import { commandErrorContainer } from '../errorContainer'
import type { SiteGateway } from '../play/client'
import { createSiteClient } from '../play/client'
import { reportError } from '../reportError'
import type { MessagePayload } from '../wire'
import { toWire } from '../wire'
import type { InitialResponse } from './adapter'
import {
  interactionName,
  makeAutocompleteInteraction,
  makeButtonInteraction,
  makeExecuteInteraction,
  ResponseSink,
  webhookRoutes,
} from './adapter'
import { probeDiscord } from './healthProbe'
import { viaFetch } from './oneShotRest'
import { isValidDiscordRequest, SIGNATURE_HEADER, TIMESTAMP_HEADER } from './verify'

/**
 * Reference data, loaded once per isolate at module scope.
 *
 * Constraint 2 above. This is the single most important line in the file for
 * staying inside Workers Free.
 */
await SalvageUnionReference.preload('all')

type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void }

const COMMAND_ERROR = 'There was an error while executing this command!'

/**
 * The fallback initial response when a handler threw or never answered. An
 * autocomplete may only be answered with choices, so it gets none; anything
 * else gets a private message.
 */
function fallbackResponse(raw: APIInteraction, content: string): InitialResponse {
  if (raw.type === InteractionType.ApplicationCommandAutocomplete) {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: { choices: [] },
    }
  }
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: toWire({ content, flags: MessageFlags.Ephemeral }),
  }
}

/**
 * The edit that replaces a spent first response with the error. A message
 * already sent as Components V2 refuses plain `content`, and a deferred
 * placeholder refuses becoming one, so the edit matches what was sent.
 */
function errorEdit(sent: InitialResponse | null): MessagePayload {
  const flags = (sent?.data as { flags?: number } | undefined)?.flags ?? 0
  if (
    sent?.type === InteractionResponseType.ChannelMessageWithSource &&
    (flags & MessageFlags.IsComponentsV2) !== 0
  ) {
    // An edit cannot change whether a message is ephemeral, so the flag stays off.
    return v2Reply(commandErrorContainer(COMMAND_ERROR))
  }
  return { content: COMMAND_ERROR }
}

/**
 * Dispatch one interaction, returning the initial response.
 *
 * The handler is NOT awaited before returning: `sink.first` resolves as soon as
 * the handler produces its first reply or defers, and the remainder continues
 * under `waitUntil`. Racing against handler completion covers the case where a
 * handler returns without ever responding — which would otherwise hang until
 * Discord's own timeout with no diagnosis.
 */
async function dispatch(
  raw: APIInteraction,
  env: Env,
  ctx: ExecutionCtx
): Promise<InitialResponse> {
  const sink = new ResponseSink()
  const rest = new REST({ version: '10', makeRequest: viaFetch }).setToken(env.DISCORD_TOKEN)
  const adapterCtx = {
    raw,
    applicationId: env.DISCORD_APPLICATION_ID,
    rest,
    sink,
  }

  // One line per interaction, so usage can be counted per command in Workers
  // Logs (docs/ARCHITECTURE.md#bot-game-client).
  const name = interactionName(raw)
  console.log(JSON.stringify({ evt: 'interaction', type: raw.type, name }))
  // The same count, kept: Workers Analytics Engine (`USAGE` in wrangler.jsonc).
  // blob1 is the name, double1 the interaction type; never anything about who.
  env.USAGE?.writeDataPoint({ indexes: [name ?? ''], blobs: [name ?? ''], doubles: [raw.type] })
  // And the weekly tally the admin metrics read (ADR-057): a command answered,
  // and the server it ran in. Off the response path; an outage only loses a count.
  if (raw.type === InteractionType.ApplicationCommand && name !== null) {
    ctx.waitUntil(site().usage(name, raw.guild_id ?? null))
  }

  let work: Promise<void>

  if (raw.type === InteractionType.ApplicationCommandAutocomplete) {
    const command = commands.get((raw as { data: { name: string } }).data.name)
    work = command?.autocomplete
      ? command.autocomplete(makeAutocompleteInteraction(adapterCtx))
      : Promise.resolve()
  } else if (raw.type === InteractionType.MessageComponent) {
    work = handleButtonInteraction(makeButtonInteraction(adapterCtx))
  } else if (raw.type === InteractionType.ApplicationCommand) {
    const command = commands.get((raw as { data: { name: string } }).data.name)
    work = command ? command.execute(makeExecuteInteraction(adapterCtx)) : Promise.resolve()
  } else {
    work = Promise.resolve()
  }

  const guarded = work.catch(async (error) => {
    reportError(error, { fn: 'dispatch', type: raw.type })

    // Two different repairs, because the sink can already be spent.
    //
    // `sink.send` is a NO-OP once settled, and `deferReply` settles it. The
    // commands that defer are exactly the ones that make a network call and can
    // therefore throw, so a `sink.send` alone would write nothing and leave
    // "<bot> is thinking…" on screen until the interaction expired.

    if (sink.settled) {
      // Already deferred (or answered). The initial response is spent, so the
      // only way to say anything is to edit the message it promised. PATCH
      // @original with the same rest client the adapter uses.
      try {
        await rest.patch(webhookRoutes(env.DISCORD_APPLICATION_ID, raw.token).original, {
          body: toWire(errorEdit(sink.sent)),
        })
      } catch (patchError) {
        // The interaction token has a 15-minute life and Discord can refuse.
        // Nothing further can be said to the user at this point; make sure the
        // reason is at least visible to us.
        reportError(patchError, { fn: 'dispatch', op: 'patch-original' })
      }
      return
    }

    // Nothing sent yet — the initial response is still ours to use.
    sink.send(fallbackResponse(raw, COMMAND_ERROR))
  })

  ctx.waitUntil(guarded)

  // Whichever comes first: the handler responds, or it finishes without
  // responding. The second is a bug, and an explicit empty ack diagnoses it far
  // better than a Discord-side timeout.
  const finished = guarded.then(() => {
    sink.send(fallbackResponse(raw, 'This command produced no response.'))
    return sink.first
  })

  return Promise.race([sink.first, finished])
}

/**
 * Deploy verification: is this Worker actually able to act as the bot?
 *
 * Answers the question a deploy cannot answer by itself. The Worker can be
 * deployed, bundle correctly, verify signatures and still be useless, because
 * what it needs at runtime — a working bot token and the app pair — is set out
 * of band and is invisible until Discord sends the first interaction.
 *
 * So this refuses (503) while the app pair is incomplete, and asks Discord
 * directly: `GET /users/@me` with the token. A 200 means the app pair is set
 * and the token is live, and names the bot it belongs to.
 *
 * Deliberately says nothing sensitive. On failure it reports Discord's status
 * code and nothing else — never the token, never a fragment of it, never the
 * response body, which can echo request details. The bot's username is public
 * (it is visible in every server it is in), so returning it costs nothing and
 * is what makes the check meaningful rather than a bare boolean.
 *
 * Unauthenticated on purpose: it reveals only public facts, and requiring a
 * credential to check a credential is a loop that helps nobody at 3am. The
 * probe is cached per isolate (`probeDiscord`), so hammering the URL cannot
 * spend the token's rate limit.
 */
async function health(env: Env): Promise<Response> {
  const configured = {
    applicationId: Boolean(env.DISCORD_APPLICATION_ID),
    publicKey: Boolean(env.DISCORD_PUBLIC_KEY),
    token: Boolean(env.DISCORD_TOKEN),
    // Without it every Game command would answer that the app cannot be reached.
    site: Boolean(env.SITE),
  }

  if (!configured.token) {
    return Response.json(
      { ok: false, reason: 'DISCORD_TOKEN is not set', configured },
      { status: 503 }
    )
  }

  if (!configured.site) {
    return Response.json(
      {
        ok: false,
        reason: 'the site service binding is missing',
        configured,
      },
      { status: 503 }
    )
  }

  const probe = await probeDiscord(env.DISCORD_TOKEN)
  if (probe === 'unreachable') {
    // Network failure reaching Discord is not a bad token; say so rather than
    // implying the credential is wrong.
    return Response.json(
      { ok: false, reason: 'could not reach Discord', configured },
      { status: 502 }
    )
  }
  const { discordStatus, botUser } = probe
  const tokenValid = discordStatus === 200

  return Response.json(
    {
      ok: tokenValid,
      // 401 here means the token is wrong or was reset. Anything else is
      // Discord having a bad day.
      discordStatus,
      botUser,
      configured,
    },
    { status: tokenValid ? 200 : 503 }
  )
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionCtx): Promise<Response> {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return health(env)
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // The RAW body, verified before it is parsed. Re-serialising a parsed body
    // does not round-trip byte-for-byte, and verifying the wrong bytes is the
    // classic way an interactions endpoint ends up accepting forgeries.
    const rawBody = await request.text()

    const valid = await isValidDiscordRequest(
      rawBody,
      request.headers.get(SIGNATURE_HEADER),
      request.headers.get(TIMESTAMP_HEADER),
      env.DISCORD_PUBLIC_KEY
    )
    if (!valid) {
      // Discord actively probes this: saving the endpoint URL sends a
      // deliberately BAD signature and expects a 401. Answering anything else
      // fails validation.
      return new Response('invalid request signature', { status: 401 })
    }

    // Configuration arrives as `env`, so the client can only be built once a
    // request exists. Cheap: a client is two strings and a closure.
    setSiteClient(createSiteClient(env.SITE as unknown as SiteGateway | undefined))

    let interaction: APIInteraction
    try {
      interaction = JSON.parse(rawBody) as APIInteraction
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    if (interaction.type === InteractionType.Ping) {
      return Response.json({ type: InteractionResponseType.Pong })
    }

    return Response.json(await dispatch(interaction, env, ctx))
  },
}
