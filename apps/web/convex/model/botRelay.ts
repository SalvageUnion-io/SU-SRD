import type { PostRollRelayResponse } from 'game-domain/botWire'

/**
 * Convex asking the bot Worker to post into a Discord channel: a roll
 * (`channelBindings.postRoll`) or a Stop Sign (`safety.postStop`). The Worker
 * holds the bot token, so nothing here calls Discord itself.
 */

/** How long a post may take before it is reported as failed. */
const RELAY_TIMEOUT_MS = 10_000

/**
 * POST `body` to the Worker's relay `path` (`BOT_URL`, bearer `BOT_SECRET`).
 * Every way it can go wrong comes back as `{ ok: false, message }`, worded for
 * whoever is waiting on it: an unset variable, an unreachable Worker, a
 * refusal from Discord.
 */
export async function relayToBot(path: string, body: object): Promise<PostRollRelayResponse> {
  const botUrl = process.env.BOT_URL?.replace(/\/+$/, '')
  const secret = process.env.BOT_SECRET
  if (!botUrl || !secret) {
    // Loud on purpose: a deployment with channels bound and no relay is a
    // configuration fault, and the Convex log is where an operator looks.
    console.error('[botRelay] BOT_URL and BOT_SECRET must both be set')
    return {
      ok: false,
      status: null,
      message: 'Posting to Discord is not configured on this deployment.',
    }
  }
  try {
    const response = await fetch(`${botUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    })
    const answer = (await response.json().catch(() => null)) as PostRollRelayResponse | null
    if (answer !== null && typeof answer === 'object' && 'ok' in answer) {
      if (answer.ok && typeof answer.messageId === 'string') return answer
      if (!answer.ok && typeof answer.message === 'string') return answer
    }
    return {
      ok: false,
      status: response.status,
      message:
        response.status === 401 || response.status === 404
          ? 'The Discord bot refused this deployment’s credentials.'
          : 'The Discord bot returned an unexpected answer.',
    }
  } catch {
    return { ok: false, status: null, message: 'The Discord bot could not be reached.' }
  }
}
