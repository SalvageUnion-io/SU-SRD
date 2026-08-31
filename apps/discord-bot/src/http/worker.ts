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
import type { ObservabilityEnv } from 'observability/cloudflare'
import { reportError, withObservability } from 'observability/cloudflare'
import { SalvageUnionReference } from 'salvageunion-reference'
import { handleButtonInteraction } from '../buttons.js'
import { commands } from '../commands/index.js'
import { normaliseWebUrl, setItunSettings } from '../itunSettings.js'
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
 * `node:path` and does not bundle for workerd, which is why this isolate cannot
 * use it.
 *
 * This is the `@sentry/cloudflare` port that comment used to defer — the last
 * of the three Workers to get one. It reports to BOTH: Workers Logs is what
 * `wrangler tail` shows during an incident, Sentry is what alerts, and dropping
 * either trades one blind spot for another.
 *
 * With no `SENTRY_DSN` secret the SDK initialises disabled and this is exactly
 * the old behaviour — a logging Worker, not a dark SDK.
 *
 * Assignment at module scope is fine: workerd forbids I/O, timers and
 * randomness in global scope, not assignment. `reportError` performs no I/O
 * until it is CALLED, which is inside a request.
 */
setReporter((error, context) => {
  console.error('[worker]', error, context ?? {})
  reportError(error, context)
})

export type Env = ObservabilityEnv & {
  DISCORD_PUBLIC_KEY: string
  DISCORD_APPLICATION_ID: string
  DISCORD_TOKEN: string
  /** Optional: the bot's avatar hash, for branding embeds. */
  DISCORD_BOT_AVATAR?: string
  /**
   * ITUN (ADR-030 Phase 6). BOTH optional and BOTH required together: with
   * either missing the bot runs in Solo mode, which is the deliberate default —
   * reference commands work exactly as they always have and Game commands say
   * they are not connected. A deploy with no credentials degrades rather than
   * crashing.
   */
  ITUN_CONVEX_SITE_URL?: string
  ITUN_BOT_SECRET?: string
  ITUN_WEB_URL?: string
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

/**
 * Deploy verification: is this Worker actually able to act as the bot?
 *
 * Answers the question a deploy cannot answer by itself. The Worker can be
 * deployed, bundle correctly, verify signatures and still be useless, because
 * the one thing it needs at runtime — a working bot token — is set out of band
 * and is invisible until Discord sends the first interaction. Waiting for that
 * means discovering a bad token *at the flip*, which is the worst possible time
 * given the cutover is atomic across every server.
 *
 * So this asks Discord directly: `GET /users/@me` with the token. A 200 means
 * the token is live and names the bot it belongs to.
 *
 * Deliberately says nothing sensitive. On failure it reports Discord's status
 * code and nothing else — never the token, never a fragment of it, never the
 * response body, which can echo request details. The bot's username is public
 * (it is visible in every server it is in), so returning it costs nothing and
 * is what makes the check meaningful rather than a bare boolean.
 *
 * Unauthenticated on purpose: it reveals only public facts, and requiring a
 * credential to check a credential is a loop that helps nobody at 3am.
 */
async function health(env: Env): Promise<Response> {
  const configured = {
    applicationId: Boolean(env.DISCORD_APPLICATION_ID),
    publicKey: Boolean(env.DISCORD_PUBLIC_KEY),
    token: Boolean(env.DISCORD_TOKEN),
    // Both or neither — either alone leaves the bot reporting itself
    // unreachable rather than cleanly Solo.
    itun: Boolean(env.ITUN_CONVEX_SITE_URL) && Boolean(env.ITUN_BOT_SECRET),
  }

  if (!configured.token) {
    return Response.json(
      { ok: false, reason: 'DISCORD_TOKEN is not set', configured },
      { status: 503 }
    )
  }

  let tokenValid = false
  let botUser: string | null = null
  let discordStatus: number | null = null

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { authorization: `Bot ${env.DISCORD_TOKEN}` },
    })
    discordStatus = res.status
    if (res.ok) {
      const body = (await res.json()) as { username?: string; id?: string }
      tokenValid = true
      botUser = body.username ?? null
    }
  } catch {
    // Network failure reaching Discord is not a bad token; say so rather than
    // implying the credential is wrong.
    return Response.json(
      { ok: false, reason: 'could not reach Discord', configured },
      { status: 502 }
    )
  }

  return Response.json(
    {
      ok: tokenValid,
      // 401 here means the token is wrong or was reset. Anything else is
      // Discord having a bad day.
      discordStatus,
      botUser,
      configured,
      mode: configured.itun ? 'connected' : 'solo',
    },
    { status: tokenValid ? 200 : 503 }
  )
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('discord-bot', {
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

    // Configuration arrives as `env`, not `process.env`, so it can only be
    // installed once a request exists. Idempotent and cheap; the ITUN client
    // resolves lazily on first use, which is why installing here rather than at
    // module scope still reaches it.
    setItunSettings({
      siteUrl: env.ITUN_CONVEX_SITE_URL,
      botSecret: env.ITUN_BOT_SECRET,
      webUrl: normaliseWebUrl(env.ITUN_WEB_URL),
    })

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
})
