import type { ResponseLike } from '@discordjs/rest'
import { REST } from '@discordjs/rest'

/**
 * A REST client that makes one attempt and never waits out a rate limit: the
 * `/health` probe reports what Discord answered now, and the relay's roller is
 * waiting on the Feed, so a retry belongs to them.
 *
 * The global `fetch` is what the web build uses on workerd; spelled out so Bun
 * (which resolves the undici build) goes through it too. The cast is only
 * Node's and the web's `ReadableStream` typings disagreeing.
 */
export function oneShotRest(token: string): REST {
  return new REST({
    version: '10',
    retries: 0,
    rejectOnRateLimit: () => true,
    makeRequest: async (url, init) =>
      (await fetch(url, init as RequestInit)) as unknown as ResponseLike,
  }).setToken(token)
}
