import { PRODUCT } from 'component-lib/product'
import type {
  DenialReason,
  GamesResult,
  ItunResult,
  MeResult,
  MineResult,
  SheetResult,
  SheetTable,
} from './types'

/**
 * The bot's client for the ITUN Convex deployment (ADR-030).
 *
 * Deliberately built on `fetch` and nothing else. The `convex` package would
 * buy a websocket and reactive subscriptions, which the bot needs exactly once
 * — for pushing Mediator alerts into a channel — which is not built. Adding a
 * dependency now for a feature later is how a Worker
 * quietly acquires a browser SDK.
 *
 * ## Degrading
 *
 * There is always a client. When the deployment cannot be reached — down,
 * timing out, rejecting the credential, or not configured at all — every call
 * answers `unavailable`, distinct from `denied`, so an outage never reads as a
 * permissions problem. Roll and lookup never wait on it: they behave the same
 * whether or not In The Union Now answers, because the reference bot is the
 * thing people already use.
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

export type ItunClient = {
  me(discordId: string): Promise<ItunResult<MeResult>>
  games(discordId: string): Promise<ItunResult<GamesResult>>
  /** What `/su sheet` autocompletes to, under the 3s autocomplete deadline. */
  mineForAutocomplete(discordId: string): Promise<ItunResult<MineResult>>
  /** One sheet by row id or app id: yours, a crewmate's, or a published one. */
  sheet(discordId: string, table: SheetTable, entityId: string): Promise<ItunResult<SheetResult>>
}

export type ItunClientConfig = {
  /** The deployment's HTTP-actions origin, e.g. `https://x.convex.site`. */
  siteUrl: string
  /** The bearer credential. See `convex/botHttp.ts` for what it authorizes. */
  botSecret: string
}

const DENIAL_REASONS: readonly string[] = ['unlinked', 'not-found']

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
      message: `${PRODUCT.name} rejected this bot’s credentials.`,
    }
  }
  if (status !== 200) {
    return { kind: 'unavailable', message: `${PRODUCT.name} could not be reached.` }
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
  return { kind: 'unavailable', message: `${PRODUCT.name} returned an unexpected response.` }
}

const UNCONFIGURED: ItunResult<never> = {
  kind: 'unavailable',
  message: `${PRODUCT.name} is not configured for this bot.`,
}

/**
 * The client. With either half of the configuration missing it makes no
 * request at all and answers every call `unavailable` — the same Degraded
 * path an outage takes. `/health` fails while that is so, so a deploy cannot
 * sit in this state unnoticed.
 */
export function createItunClient(config: Partial<ItunClientConfig>): ItunClient {
  const { siteUrl, botSecret } = config
  const origin = siteUrl?.replace(/\/+$/, '') ?? ''

  async function call<T>(
    op: string,
    payload: Record<string, unknown>,
    forAutocomplete = false
  ): Promise<ItunResult<T>> {
    if (!origin || !botSecret) return UNCONFIGURED
    try {
      const response = await fetch(`${origin}/bot/${op}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(forAutocomplete ? AUTOCOMPLETE_TIMEOUT_MS : REQUEST_TIMEOUT_MS),
      })

      // A non-JSON body from a proxy or an error page must not throw past the
      // caller — it is just another way for the deployment to be unavailable.
      const json: unknown = await response.json().catch(() => null)
      return interpret<T>(response.status, json)
    } catch {
      // Timeout or network failure: the bot's Degraded mode, by design. It is
      // worded to the user as an outage, and ITUN's own monitoring owns it.
      return { kind: 'unavailable', message: `${PRODUCT.name} could not be reached.` }
    }
  }

  return {
    me: (discordId) => call('me', { discordId }),
    games: (discordId) => call('games', { discordId }),
    mineForAutocomplete: (discordId) => call('mine', { discordId }, true),
    sheet: (discordId, table, entityId) => call('sheet', { discordId, table, entityId }),
  }
}
