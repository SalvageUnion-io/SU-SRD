import type { BotRelay, PostRollRelayResponse, PostStopRelayRequest } from 'game-domain/botWire'
import { BOT_RELAY_POST_STOP_PATH, relayUrl } from 'game-domain/botWire'
import type { SharedDb } from './db'

/**
 * A Game room posting its Stop Sign to the Game's bound channel, or, with
 * none bound, to the table runner's own channel (as their rolls fall back to
 * it, `rollChannel`), through the
 * bot Worker's relay (`apps/discord-bot/src/worker/relay.ts`). The bot holds
 * the token and the fixed words, so nothing a player typed reaches Discord
 * this way. It never falls back to whoever showed it: their channel would
 * name them, and the Stop Sign never says who.
 *
 * `BOT` is the Worker's service binding to the bot (`wrangler.jsonc`, not on
 * a Preview); unbound, nothing posts and the log says why. Play has already paused by
 * then, which is what the table relies on, so a failure is only logged.
 */

/** What posting needs from the Worker's environment. */
export type StopSignEnv = { SHARED?: SharedDb; BOT?: BotRelay }

/** How long a post may take before it is reported as failed. */
const RELAY_TIMEOUT_MS = 10_000

export async function postStopSign(
  env: StopSignEnv,
  gameId: string,
  /** The table runners' Discord ids, whose own channel stands in for an unbound Game's. */
  runners: readonly string[] = []
): Promise<void> {
  if (!env.BOT || !env.SHARED) {
    console.error('[stopSign] SHARED and BOT must both be bound to post')
    return
  }
  // Read here, not through `channelBindings.ts`, whose Game reads pull the
  // link previews' components into the room's bundle.
  const binding =
    (await env.SHARED.prepare(
      'select channel_id as channelId from channel_bindings where game_id = ?1'
    )
      .bind(gameId)
      .first<{ channelId: string }>()) ?? (await runnerChannel(env.SHARED, runners))
  if (binding === null) return
  const request: PostStopRelayRequest = { channelId: binding.channelId }
  try {
    const response = await env.BOT.fetch(relayUrl(BOT_RELAY_POST_STOP_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    })
    const answer = (await response.json().catch(() => null)) as PostRollRelayResponse | null
    if (answer?.ok === true) return
    console.warn(`[stopSign] post to ${binding.channelId} failed (${response.status})`, answer)
  } catch (error) {
    console.warn(
      `[stopSign] post to ${binding.channelId} failed: the bot could not be reached`,
      error
    )
  }
}

/** The first table runner's own (solo) channel; null when none of them bound one. */
async function runnerChannel(
  db: SharedDb,
  runners: readonly string[]
): Promise<{ channelId: string } | null> {
  for (const runner of runners) {
    const own = await db
      .prepare(
        'select channel_id as channelId from channel_bindings where game_id is null and bound_by = ?1'
      )
      .bind(runner)
      .first<{ channelId: string }>()
    if (own !== null) return own
  }
  return null
}
