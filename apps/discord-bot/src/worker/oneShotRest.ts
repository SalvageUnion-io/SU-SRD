import type { ResponseLike } from '@discordjs/rest'
import { REST } from '@discordjs/rest'

/**
 * The global `fetch`, read at call time. It is what the web build uses on
 * workerd; spelled out so Bun (which resolves the undici build, or captures
 * `fetch` at import) goes through it too, and a test's stub sees the call. The
 * cast is only Node's and the web's `ReadableStream` typings disagreeing.
 */
export const viaFetch = async (url: string, init: unknown): Promise<ResponseLike> =>
  (await fetch(url, init as RequestInit)) as unknown as ResponseLike

/**
 * A REST client that makes one attempt and never waits out a rate limit: the
 * `/health` probe reports what Discord answered now, and the relay's roller is
 * waiting on the Feed, so a retry belongs to them.
 */
export function oneShotRest(token: string): REST {
  return new REST({
    version: '10',
    retries: 0,
    rejectOnRateLimit: () => true,
    makeRequest: viaFetch,
  }).setToken(token)
}
