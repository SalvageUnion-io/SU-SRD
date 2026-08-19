import { afterEach, describe, expect, test } from 'bun:test'
import type { Env } from '../worker.js'
import worker from '../worker.js'

/**
 * The `/health` endpoint.
 *
 * It exists because a deploy cannot answer the question it answers: the Worker
 * can bundle, deploy and verify signatures while still being useless, because a
 * bad bot token is invisible until Discord sends the first interaction. Given
 * the bot cutover is atomic across every server, "discover it at the flip" is
 * the worst available time.
 *
 * These tests pin the two properties that make it worth having:
 *
 *   1. it reports the TRUTH about the token, by asking Discord rather than by
 *      checking that a variable is non-empty, and
 *   2. it leaks nothing — on failure it says a status code and no more. The bot
 *      username is deliberately included because it is public (visible in every
 *      server the bot is in) and it is what turns a bare boolean into a useful
 *      answer.
 */

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * Replace `fetch` for the duration of one test. Restored in `afterEach`.
 *
 * The input is spelled out rather than using `RequestInfo`: this app has no DOM
 * lib (the gateway half is Node), so that name does not exist here — the same
 * reason `verify.ts` declares its own WebCrypto slice.
 */
function stubFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = handler as typeof fetch
}

function envWith(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
    DISCORD_APPLICATION_ID: '111111111111111111',
    DISCORD_TOKEN: 'a-token',
    ...overrides,
  } as Env
}

const ctx = { waitUntil: () => {} }
const healthRequest = () => new Request('https://bot.example/health')

describe('/health', () => {
  test('reports ok when Discord accepts the token, and names the bot', async () => {
    stubFetch(async (input, init) => {
      expect(String(input)).toBe('https://discord.com/api/v10/users/@me')
      // The token must be presented as a BOT credential; `Bearer` is a
      // different authentication scheme and Discord rejects it.
      const headers = (init?.headers ?? {}) as Record<string, string>
      expect(headers.authorization).toBe('Bot a-token')
      return Response.json({ username: 'SalvageUnion.io', id: '1' }, { status: 200 })
    })

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as { ok: boolean; botUser: string; mode: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.botUser).toBe('SalvageUnion.io')
  })

  test('503s when Discord rejects the token, and reports only the status code', async () => {
    stubFetch(async () => Response.json({ message: '401: Unauthorized' }, { status: 401 }))

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.discordStatus).toBe(401)
    // Nothing about the token itself, and not Discord's response body — which
    // can echo request details.
    expect(JSON.stringify(body)).not.toContain('a-token')
    expect(JSON.stringify(body)).not.toContain('Unauthorized')
  })

  test('503s with a clear reason when no token is configured, without calling Discord', async () => {
    let called = false
    stubFetch(async () => {
      called = true
      return Response.json({}, { status: 200 })
    })

    const res = await worker.fetch(healthRequest(), envWith({ DISCORD_TOKEN: '' }), ctx)
    const body = (await res.json()) as { ok: boolean; reason: string }

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.reason).toContain('DISCORD_TOKEN')
    expect(called).toBe(false)
  })

  test('502s when Discord is unreachable — not a bad token, and it says so', async () => {
    // A network failure must not be reported as an authentication problem;
    // sending someone to rotate a working credential is worse than saying
    // nothing.
    stubFetch(async () => {
      throw new Error('network down')
    })

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as { ok: boolean; reason: string }

    expect(res.status).toBe(502)
    expect(body.reason).toContain('reach Discord')
  })

  test('reports Solo mode when the ITUN pair is absent', async () => {
    stubFetch(async () => Response.json({ username: 'bot' }, { status: 200 }))

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as { mode: string; configured: Record<string, boolean> }

    expect(body.mode).toBe('solo')
    expect(body.configured.itun).toBe(false)
  })

  test('reports Connected only when BOTH ITUN values are present', async () => {
    stubFetch(async () => Response.json({ username: 'bot' }, { status: 200 }))

    // One alone is not Connected — it is the misconfiguration that makes every
    // Game command report the deployment unreachable instead of cleanly Solo.
    const halfConfigured = await worker.fetch(
      healthRequest(),
      envWith({ ITUN_CONVEX_SITE_URL: 'https://x.convex.site' }),
      ctx
    )
    expect(((await halfConfigured.json()) as { mode: string }).mode).toBe('solo')

    const both = await worker.fetch(
      healthRequest(),
      envWith({ ITUN_CONVEX_SITE_URL: 'https://x.convex.site', ITUN_BOT_SECRET: 's' }),
      ctx
    )
    expect(((await both.json()) as { mode: string }).mode).toBe('connected')
  })

  test('only answers GET /health — any other path falls through to 405', async () => {
    const res = await worker.fetch(new Request('https://bot.example/healthz'), envWith(), ctx)
    expect(res.status).toBe(405)
  })
})
