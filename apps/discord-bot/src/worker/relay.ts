/**
 * The relay: Convex asking the bot to post a Play roll into a bound channel
 * (`convex/channelBindings.ts#postRoll`, wire shapes in `cantina-domain/botWire`).
 *
 * The Worker is the one place holding both the bot token and the roll card, so
 * Convex sends the roll and the bot renders it with `buildPostedRollMessage`:
 * the message in the channel is exactly the card `/su roll` posts, with its
 * `↻ Roll again` (only the roller's) and `See table` buttons. It is posted as
 * a NEW message with the bot token, since there is no interaction to answer.
 *
 * Authenticated with the bearer `CANTINA_BOT_SECRET`, the same value the bot
 * presents to Convex's `/bot/*`, in the other direction. Unset, the relay is
 * a 404, as `/bot/*` is on a deployment that has not opted in.
 *
 * Every failure answers with a sentence fit for the roller, because Play shows
 * it in the Feed: posting is never allowed to fail silently.
 */

import type { ResponseLike } from '@discordjs/rest'
import { DiscordAPIError, HTTPError, RateLimitError, REST } from '@discordjs/rest'
import type { PostRollRelayRequest, PostRollRelayResponse } from 'cantina-domain/botWire'
import { Routes } from 'discord-api-types/v10'
import { buildPostedRollMessage } from '../commands/roll'
import { encodeRollResult } from '../customId'
import { reportError } from '../reportError'

/** Compare two secrets without an early exit (`secretsMatch` in `convex/botHttp.ts`). */
function secretsMatch(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

function answer(body: PostRollRelayResponse | { error: string }, status: number): Response {
  return Response.json(body, { status })
}

/** A request body is a roll the card can replay, or null. */
function parseRequest(body: unknown): PostRollRelayRequest | null {
  const raw = body as Partial<PostRollRelayRequest> | null
  if (raw === null || typeof raw !== 'object') return null
  const { channelId, tableName, rolls, roller, ownerDiscordId } = raw
  if (typeof channelId !== 'string' || !/^\d{1,25}$/.test(channelId)) return null
  // `|` separates the parts of a roll result (`encodeRollResult`).
  if (typeof tableName !== 'string' || tableName.length === 0 || tableName.includes('|')) {
    return null
  }
  if (!Array.isArray(rolls) || rolls.length < 1 || rolls.length > 2) return null
  if (!rolls.every((n) => Number.isInteger(n) && n >= 1 && n <= 20)) return null
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

/** Handle `POST BOT_RELAY_POST_ROLL_PATH`. */
export async function handlePostRoll(request: Request, env: Env): Promise<Response> {
  const expected = env.CANTINA_BOT_SECRET
  if (!expected) return answer({ error: 'not found' }, 404)
  const match = /^Bearer (.+)$/.exec((request.headers.get('Authorization') ?? '').trim())
  if (!match?.[1] || !secretsMatch(match[1], expected)) {
    return answer({ error: 'unauthorized' }, 401)
  }

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

  // One attempt: the roller is waiting on the Feed, and a retry belongs to them.
  // The global `fetch` spelled out as in `/health`, so Bun's tests go through it.
  const rest = new REST({
    version: '10',
    retries: 0,
    rejectOnRateLimit: () => true,
    makeRequest: async (url, init) =>
      (await fetch(url, init as RequestInit)) as unknown as ResponseLike,
  }).setToken(env.DISCORD_TOKEN)

  try {
    const posted = (await rest.post(Routes.channelMessages(parsed.channelId), {
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
    reportError(error, { fn: 'handlePostRoll' })
    return answer({ ok: false, status: null, message: 'Discord could not be reached.' }, 200)
  }
}
