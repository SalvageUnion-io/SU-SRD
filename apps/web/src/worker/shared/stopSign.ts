import type {
  BotRelay,
  PostAlertRelayRequest,
  PostRollRelayResponse,
  PostStopRelayRequest,
} from 'game-domain/botWire'
import { BOT_RELAY_POST_ALERT_PATH, BOT_RELAY_POST_STOP_PATH, relayUrl } from 'game-domain/botWire'
import type { SharedDb } from './db'

/**
 * A Game room's posts to the table's Discord channel, through the bot Worker's
 * relay (`apps/discord-bot/src/worker/relay.ts`): the Stop Sign (the bot's
 * fixed words) and the Mediator's alert (Tell the table, its words). While a
 * channel is bound everything posts there, with no opt-in; unbinding is how it
 * stops.
 *
 * The channel is the Game's, or, with none bound, a table runner's own (as
 * their rolls fall back to it, `rollChannel`). Never whoever showed the Stop
 * Sign's: their channel would name them, and the Stop Sign never says who.
 *
 * `BOT` is the Worker's service binding to the bot (`wrangler.jsonc`, not on
 * a Preview); unbound, nothing posts and the log says why. The table has
 * already seen it in Play by then, so a failure is only logged.
 */

/** What posting needs from the Worker's environment. */
export type StopSignEnv = { SHARED?: SharedDb; BOT?: BotRelay }

/** How long a post may take before it is reported as failed. */
const RELAY_TIMEOUT_MS = 10_000

/** The Stop Sign, to the table's channel. */
export function postStopSign(
  env: StopSignEnv,
  gameId: string,
  /** The table runners' Discord ids, whose own channel stands in for an unbound Game's. */
  runners: readonly string[] = []
): Promise<void> {
  return postToTable(env, gameId, runners, 'stopSign', BOT_RELAY_POST_STOP_PATH, (channelId) => {
    const request: PostStopRelayRequest = { channelId }
    return request
  })
}

/** The Mediator's alert (Tell the table), to the table's channel. */
export function postTableAlert(
  env: StopSignEnv,
  gameId: string,
  message: string,
  runners: readonly string[] = []
): Promise<void> {
  return postToTable(env, gameId, runners, 'alert', BOT_RELAY_POST_ALERT_PATH, (channelId) => {
    const request: PostAlertRelayRequest = { channelId, message }
    return request
  })
}

async function postToTable(
  env: StopSignEnv,
  gameId: string,
  runners: readonly string[],
  what: string,
  path: string,
  body: (channelId: string) => object
): Promise<void> {
  if (!env.BOT || !env.SHARED) {
    console.error(`[${what}] SHARED and BOT must both be bound to post`)
    return
  }
  const channel = await tableChannel(env.SHARED, gameId, runners)
  if (channel === null) return
  try {
    const response = await env.BOT.fetch(relayUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body(channel)),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    })
    const answer = (await response.json().catch(() => null)) as PostRollRelayResponse | null
    if (answer?.ok === true) return
    console.warn(`[${what}] post to ${channel} failed (${response.status})`, answer)
  } catch (error) {
    console.warn(`[${what}] post to ${channel} failed: the bot could not be reached`, error)
  }
}

/**
 * The Game's bound channel, else the first table runner's own (solo) one; null
 * when there is neither. Read here, not through `channelBindings.ts`, whose
 * Game reads pull the link previews' components into the room's bundle.
 */
async function tableChannel(
  db: SharedDb,
  gameId: string,
  runners: readonly string[]
): Promise<string | null> {
  const game = await db
    .prepare('select channel_id as channelId from channel_bindings where game_id = ?1')
    .bind(gameId)
    .first<{ channelId: string }>()
  if (game !== null) return game.channelId
  for (const runner of runners) {
    const own = await db
      .prepare(
        'select channel_id as channelId from channel_bindings where game_id is null and bound_by = ?1'
      )
      .bind(runner)
      .first<{ channelId: string }>()
    if (own !== null) return own.channelId
  }
  return null
}
