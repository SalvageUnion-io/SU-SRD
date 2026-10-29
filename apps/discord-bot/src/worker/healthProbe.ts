import { DiscordAPIError, HTTPError, RateLimitError } from '@discordjs/rest'
import type { APIUser } from 'discord-api-types/v10'
import { Routes } from 'discord-api-types/v10'
import { oneShotRest } from './oneShotRest'

/** What Discord answered `/health`'s token check, or that it could not be reached. */
export type Probe = { discordStatus: number; botUser: string | null } | 'unreachable'

/** How long one isolate reuses Discord's answer to `/health`'s probe. */
const PROBE_TTL_MS = 60_000

/**
 * The last probe, per isolate. `/health` is public, and every uncached probe
 * spends the bot token's rate limit, which the relay and the follow-ups share.
 */
let lastProbe: { token: string; at: number; probe: Probe } | null = null

/** Forget the cached probe, so a test's stubbed Discord is asked. */
export function resetHealthProbe(): void {
  lastProbe = null
}

/**
 * Ask Discord who the token belongs to (`GET /users/@me`), reusing an answer
 * younger than `PROBE_TTL_MS`. One attempt, no waiting out a rate limit: a
 * probe reports what Discord answered.
 */
export async function probeDiscord(token: string): Promise<Probe> {
  const now = Date.now()
  if (lastProbe !== null && lastProbe.token === token && now - lastProbe.at < PROBE_TTL_MS) {
    return lastProbe.probe
  }
  let probe: Probe
  try {
    const me = (await oneShotRest(token).get(Routes.user())) as Partial<APIUser>
    probe = { discordStatus: 200, botUser: me.username ?? null }
  } catch (err) {
    if (err instanceof DiscordAPIError || err instanceof HTTPError) {
      probe = { discordStatus: err.status, botUser: null }
    } else if (err instanceof RateLimitError) {
      probe = { discordStatus: 429, botUser: null }
    } else {
      probe = 'unreachable'
    }
  }
  lastProbe = { token, at: now, probe }
  return probe
}
