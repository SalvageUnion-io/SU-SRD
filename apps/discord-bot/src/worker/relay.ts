/**
 * The relay: Convex asking the bot to post a Play roll into a bound channel
 * (`convex/channelBindings.ts#postRoll`, wire shapes in `game-domain/botWire`),
 * or a Stop Sign (`convex/safety.ts#postStop`, `handlePostStop`).
 *
 * The Worker is the one place holding both the bot token and the roll card, so
 * Convex sends the roll and the bot renders it with `buildPostedRollMessage`:
 * the message in the channel is exactly the card `/su roll` posts, with its
 * `↻ Roll again` (only the roller's) and `See table` buttons. It is posted as
 * a NEW message with the bot token, since there is no interaction to answer.
 *
 * Authenticated with the bearer `BOT_SECRET`, the same value the bot
 * presents to Convex's `/bot/*`, in the other direction. Unset, the relay is
 * a 404, as `/bot/*` is on a deployment that has not opted in.
 *
 * Every failure answers with a sentence fit for the roller, because Play shows
 * it in the Feed: posting is never allowed to fail silently.
 */

import { DiscordAPIError, HTTPError, RateLimitError } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import type {
  PostRollRelayRequest,
  PostRollRelayResponse,
  PostStopRelayRequest,
} from 'game-domain/botWire'
import { bearerToken, isPostableRoll, secretsMatch } from 'game-domain/botWire'
import { buildPostedRollMessage } from '../commands/roll'
import { v2Reply } from '../container'
import { encodeRollResult } from '../customId'
import { reportError } from '../reportError'
import { stopSignContainer } from '../stopSignContainer'
import { oneShotRest } from './oneShotRest'

function answer(body: PostRollRelayResponse | { error: string }, status: number): Response {
  return Response.json(body, { status })
}

/** A Discord channel id: a snowflake, digits only. */
function isChannelId(channelId: unknown): channelId is string {
  return typeof channelId === 'string' && /^\d{1,25}$/.test(channelId)
}

/** A request body is a roll the card can replay, or null. */
function parseRequest(body: unknown): PostRollRelayRequest | null {
  const raw = body as Partial<PostRollRelayRequest> | null
  if (raw === null || typeof raw !== 'object') return null
  const { channelId, tableName, rolls, roller, ownerDiscordId } = raw
  if (!isChannelId(channelId)) return null
  // `|` separates the parts of a roll result (`encodeRollResult`).
  if (typeof tableName !== 'string' || tableName.includes('|')) return null
  if (!Array.isArray(rolls) || !isPostableRoll(tableName, rolls)) return null
  return {
    channelId,
    tableName,
    rolls,
    ...(typeof roller === 'string' && roller.length > 0 ? { roller } : {}),
    ...(typeof ownerDiscordId === 'string' && ownerDiscordId.length > 0 ? { ownerDiscordId } : {}),
  }
}

/** Discord's refusal, worded for the roller. */
function discordFailure(status: number, code: number | string | null): string {
  if (status === 404 || code === 10003) return 'The bound channel no longer exists.'
  if (status === 403 || code === 50001 || code === 50013) {
    return 'The bot cannot post in the bound channel: add it to the server and let it send messages there.'
  }
  if (status === 429) return 'Discord is rate-limiting the bot; try again in a moment.'
  return `Discord refused the post (${status}).`
}

/** The relay's 404 or 401 when the request may not post, else null. */
function refusal(request: Request, env: Env): Response | null {
  const expected = env.BOT_SECRET
  if (!expected) return answer({ error: 'not found' }, 404)
  const presented = bearerToken(request.headers.get('Authorization'))
  if (presented === null || !secretsMatch(presented, expected)) {
    return answer({ error: 'unauthorized' }, 401)
  }
  return null
}

/**
 * Post one message to a channel with the bot token, answering with its id or
 * Discord's refusal in words. One attempt: whoever asked is waiting on Play,
 * and a retry belongs to them.
 */
async function postToChannel(
  env: Env,
  channelId: string,
  payload: object,
  fn: string
): Promise<Response> {
  const rest = oneShotRest(env.DISCORD_TOKEN)
  try {
    const posted = (await rest.post(Routes.channelMessages(channelId), {
      body: payload,
    })) as { id?: string }
    return answer({ ok: true, messageId: posted.id ?? '' }, 200)
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      return answer(
        { ok: false, status: error.status, message: discordFailure(error.status, error.code) },
        200
      )
    }
    if (error instanceof HTTPError) {
      return answer(
        { ok: false, status: error.status, message: discordFailure(error.status, null) },
        200
      )
    }
    if (error instanceof RateLimitError) {
      return answer({ ok: false, status: 429, message: discordFailure(429, null) }, 200)
    }
    reportError(error, { fn })
    return answer({ ok: false, status: null, message: 'Discord could not be reached.' }, 200)
  }
}

/** Handle `POST BOT_RELAY_POST_ROLL_PATH`. */
export async function handlePostRoll(request: Request, env: Env): Promise<Response> {
  const refused = refusal(request, env)
  if (refused !== null) return refused

  const parsed = parseRequest(await request.json().catch(() => null))
  if (parsed === null) {
    return answer({ ok: false, status: null, message: 'That roll cannot be posted.' }, 400)
  }

  const message = buildPostedRollMessage(
    encodeRollResult(parsed.tableName, parsed.rolls),
    parsed.roller,
    parsed.ownerDiscordId
  )
  if ('error' in message) {
    return answer({ ok: false, status: null, message: message.error }, 422)
  }
  const { data: _data, ephemeral: _ephemeral, ...payload } = message
  return postToChannel(env, parsed.channelId, payload, 'handlePostRoll')
}

/** Handle `POST BOT_RELAY_POST_STOP_PATH`: the Stop Sign's fixed post (`stopSignContainer`). */
export async function handlePostStop(request: Request, env: Env): Promise<Response> {
  const refused = refusal(request, env)
  if (refused !== null) return refused

  const body = (await request.json().catch(() => null)) as Partial<PostStopRelayRequest> | null
  const channelId = body !== null && typeof body === 'object' ? body.channelId : undefined
  if (!isChannelId(channelId)) {
    return answer({ ok: false, status: null, message: 'That channel cannot be posted to.' }, 400)
  }
  return postToChannel(env, channelId, v2Reply(stopSignContainer()), 'handlePostStop')
}
