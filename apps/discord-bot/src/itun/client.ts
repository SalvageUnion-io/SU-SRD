import type {
  BindResult,
  ChannelResult,
  CrewResult,
  DenialReason,
  GamesResult,
  ItunResult,
  MeResult,
  SheetResult,
  ShelfResult,
} from './types.js'

/**
 * The bot's client for the ITUN Convex deployment (ADR-030 Phase 6).
 *
 * Deliberately built on `fetch` and nothing else. The `convex` package would
 * buy a websocket and reactive subscriptions, which the bot needs exactly once
 * — for pushing Mediator alerts into a channel — and that is Phase 5, which is
 * not built. Adding a dependency now for a feature later is how a Node worker
 * quietly acquires a browser SDK.
 *
 * ## Modes
 *
 * The bot mirrors ADR-030's storage modes, and `createItunClient` returning
 * `null` is what **Solo** looks like: no `ITUN_CONVEX_SITE_URL`, no client, and
 * every Game command answers "this server isn't connected". Roll, check and
 * lookup are untouched in that state — they must behave identically whether or
 * not accounts exist, because the reference bot is the thing people already
 * use.
 *
 * A configured-but-unreachable deployment is **Degraded**: `unavailable`,
 * distinct from `denied`, so an outage never reads as a permissions problem.
 */

/** Requests are user-facing; a slow deployment must not hold a slash command. */
const REQUEST_TIMEOUT_MS = 8_000

/**
 * Autocomplete gets a much tighter budget than everything else.
 *
 * Discord gives an autocomplete interaction **3 seconds** and it cannot be
 * deferred — miss it and `respond()` throws `Unknown interaction`, once per
 * keystroke, which is far worse than an empty list. So these calls give up
 * early and the picker simply shows nothing.
 */
const AUTOCOMPLETE_TIMEOUT_MS = 2_000

/** Ops invoked from an autocomplete handler, where the 3s deadline applies. */
const AUTOCOMPLETE_OPS = new Set(['crew', 'games'])

export type ItunClient = {
  me(discordId: string): Promise<ItunResult<MeResult>>
  games(discordId: string): Promise<ItunResult<GamesResult>>
  shelf(discordId: string): Promise<ItunResult<ShelfResult>>
  channel(discordId: string, channelId: string): Promise<ItunResult<ChannelResult>>
  crew(discordId: string, channelId: string): Promise<ItunResult<CrewResult>>
  /** As `crew`/`games`, but under the 3s autocomplete deadline. */
  crewForAutocomplete(discordId: string, channelId: string): Promise<ItunResult<CrewResult>>
  gamesForAutocomplete(discordId: string): Promise<ItunResult<GamesResult>>
  sheet(
    discordId: string,
    channelId: string,
    table: 'pilots' | 'mechs',
    entityId: string
  ): Promise<ItunResult<SheetResult>>
  bind(discordId: string, channelId: string, gameId: string): Promise<ItunResult<BindResult>>
  unbind(discordId: string, channelId: string): Promise<ItunResult<Record<string, never>>>
  recordRoll(
    discordId: string,
    channelId: string,
    description: string,
    result: unknown
  ): Promise<ItunResult<{ game: string }>>
}

export type ItunClientConfig = {
  /** The deployment's HTTP-actions origin, e.g. `https://x.convex.site`. */
  siteUrl: string
  /** The bearer credential. See `convex/botHttp.ts` for what it authorizes. */
  botSecret: string
}

const DENIAL_REASONS: readonly string[] = [
  'unlinked',
  'unbound',
  'not-a-member',
  'forbidden',
  'not-found',
]

function isDenial(value: unknown): value is { reason: DenialReason; message?: string } {
  const reason = (value as { reason?: unknown } | null)?.reason
  return typeof reason === 'string' && DENIAL_REASONS.includes(reason)
}

/**
 * Interpret one `/bot/<op>` response.
 *
 * Exported for tests: this is where a wire payload becomes a typed result, so
 * it is where a malformed or unexpected body has to be handled rather than
 * assumed away.
 */
export function interpret<T>(status: number, body: unknown): ItunResult<T> {
  if (status === 401 || status === 404) {
    // The bot presenting a bad credential, or hitting a deployment with the
    // route disabled, is a *configuration* fault — not the user's fault, and
    // not something to word as a permissions denial.
    return {
      kind: 'unavailable',
      message: 'In The Union Now rejected this bot’s credentials.',
    }
  }
  if (status !== 200) {
    return { kind: 'unavailable', message: 'In The Union Now could not be reached.' }
  }
  if ((body as { ok?: unknown } | null)?.ok === true) {
    return { kind: 'ok', value: body as T }
  }
  if (isDenial(body)) {
    return {
      kind: 'denied',
      reason: body.reason,
      message: body.message ?? 'That is not available to you.',
    }
  }
  return { kind: 'unavailable', message: 'In The Union Now returned an unexpected response.' }
}

/**
 * A client, or `null` when the bot is not configured for ITUN (Solo mode).
 *
 * Returning null rather than a throwing stub is what keeps Solo honest: there
 * is no client to accidentally call, so a missing configuration is a compile-
 * visible `null` check at every call site rather than a runtime surprise.
 */
export function createItunClient(config: Partial<ItunClientConfig>): ItunClient | null {
  const { siteUrl, botSecret } = config
  if (!siteUrl || !botSecret) return null

  const origin = siteUrl.replace(/\/+$/, '')

  async function call<T>(
    op: string,
    payload: Record<string, unknown>,
    forAutocomplete = false
  ): Promise<ItunResult<T>> {
    try {
      const response = await fetch(`${origin}/bot/${op}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(
          forAutocomplete && AUTOCOMPLETE_OPS.has(op) ? AUTOCOMPLETE_TIMEOUT_MS : REQUEST_TIMEOUT_MS
        ),
      })

      // A non-JSON body from a proxy or an error page must not throw past the
      // caller — it is just another way for the deployment to be unavailable.
      const body: unknown = await response.json().catch(() => null)
      return interpret<T>(response.status, body)
    } catch {
      return { kind: 'unavailable', message: 'In The Union Now could not be reached.' }
    }
  }

  return {
    me: (discordId) => call('me', { discordId }),
    games: (discordId) => call('games', { discordId }),
    shelf: (discordId) => call('shelf', { discordId }),
    channel: (discordId, channelId) => call('channel', { discordId, channelId }),
    crew: (discordId, channelId) => call('crew', { discordId, channelId }),
    crewForAutocomplete: (discordId, channelId) => call('crew', { discordId, channelId }, true),
    gamesForAutocomplete: (discordId) => call('games', { discordId }, true),
    sheet: (discordId, channelId, table, entityId) =>
      call('sheet', { discordId, channelId, table, entityId }),
    bind: (discordId, channelId, gameId) => call('bind', { discordId, channelId, gameId }),
    unbind: (discordId, channelId) => call('unbind', { discordId, channelId }),
    recordRoll: (discordId, channelId, description, result) =>
      call('recordRoll', { discordId, channelId, description, result }),
  }
}
