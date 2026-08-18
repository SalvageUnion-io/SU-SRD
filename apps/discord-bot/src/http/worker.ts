/**
 * Cloudflare Worker entrypoint for Discord HTTP interactions (ADR-033 §1).
 *
 * The gateway entry (`src/index.ts`) is untouched and still ships to Render.
 * Both transports drive the SAME handlers, because `commands/` depends on the
 * narrow structural types in `commands/interactions.ts` rather than on
 * `discord.js` classes. That is what makes this a second front door rather than
 * a fork.
 *
 * Cutting over is a Discord setting, not a deploy: setting the application's
 * Interactions Endpoint URL stops `INTERACTION_CREATE` reaching the gateway.
 * The two are **mutually exclusive** and the setting is application-wide, so
 * there is no canary and no test guild — which is why the replay harness in
 * `__tests__/` is the gate rather than a staged rollout.
 *
 * ## Four workerd constraints this file exists to respect
 *
 * Measured on real workerd during P2, not inferred:
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
import { InteractionResponseType, InteractionType } from 'discord-api-types/v10'
import { SalvageUnionReference } from 'salvageunion-reference'
import { handleButtonInteraction } from '../buttons.js'
import { commands } from '../commands/index.js'
import { setReporter } from '../report.js'
import {
  makeAutocompleteInteraction,
  makeButtonInteraction,
  makeExecuteInteraction,
  ResponseSink,
} from './adapter.js'
import { isValidDiscordRequest, SIGNATURE_HEADER, TIMESTAMP_HEADER } from './verify.js'

/**
 * Reference data, loaded once per isolate at module scope.
 *
 * Constraint 2 above. This is the single most important line in the file for
 * staying inside Workers Free.
 */
await SalvageUnionReference.preload('all')

/**
 * Shared code reports through `report.ts`, which names no transport. The
 * gateway installs `@sentry/node`; that package drags in OpenTelemetry and
 * `node:path` and does not bundle for workerd, so this isolate logs instead.
 *
 * Swapping this for `@sentry/cloudflare` is the one remaining Sentry port
 * (ADR-033) and is deliberately NOT bundled in here yet — it needs a DSN and a
 * `wrangler secret`, and shipping a dark SDK is the exact failure
 * `check-observability.ts` exists to prevent. Until then the Worker's errors are
 * in `wrangler tail`, which is where its logs already are.
 *
 * Assignment at module scope is fine: workerd forbids I/O, timers and
 * randomness in global scope, not assignment.
 */
setReporter((error, context) => {
  console.error('[worker]', error, context ?? {})
})

export type Env = {
  DISCORD_PUBLIC_KEY: string
  DISCORD_APPLICATION_ID: string
  DISCORD_TOKEN: string
  /** Optional: the bot's avatar hash, for branding embeds. */
  DISCORD_BOT_AVATAR?: string
}

type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
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
): Promise<{ type: number; data?: unknown }> {
  const sink = new ResponseSink()
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)
  const adapterCtx = {
    raw,
    applicationId: env.DISCORD_APPLICATION_ID,
    botAvatarHash: env.DISCORD_BOT_AVATAR ?? null,
    rest,
    sink,
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

  const guarded = work.catch((error) => {
    console.error('interaction handler failed:', error)
    // The handler may have already answered; if not, say something rather than
    // letting Discord time out with "The application did not respond".
    sink.send({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'There was an error while executing this command!', flags: 64 },
    })
  })

  ctx.waitUntil(guarded)

  // Whichever comes first: the handler responds, or it finishes without
  // responding. The second is a bug, and an explicit empty ack diagnoses it far
  // better than a Discord-side timeout.
  const finished = guarded.then(() => {
    sink.send({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'This command produced no response.', flags: 64 },
    })
    return sink.first
  })

  return Promise.race([sink.first, finished])
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionCtx): Promise<Response> {
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

    let interaction: APIInteraction
    try {
      interaction = JSON.parse(rawBody) as APIInteraction
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    if (interaction.type === InteractionType.Ping) {
      return json({ type: InteractionResponseType.Pong })
    }

    return json(await dispatch(interaction, env, ctx))
  },
}
