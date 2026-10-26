import { describe, expect, test } from 'bun:test'
import worker from '../index'
import { withFetchStub } from './stubFetch'

/**
 * The `/health` endpoint.
 *
 * It exists because a deploy cannot answer the question it answers: the Worker
 * can bundle, deploy and verify signatures while still being useless, because a
 * bad bot token or a missing app secret is invisible until Discord sends the
 * first interaction.
 *
 * These tests pin the three properties that make it worth having:
 *
 *   1. it reports the TRUTH about the token, by asking Discord rather than by
 *      checking that a variable is non-empty,
 *   2. it fails while the app pair is incomplete, so the post-deploy smoke
 *      catches a missing secret, and
 *   3. it leaks nothing — on failure it says a status code and no more. The bot
 *      username is deliberately included because it is public (visible in every
 *      server the bot is in) and it is what turns a bare boolean into a useful
 *      answer.
 */

const stubFetch = withFetchStub()

function envWith(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
    DISCORD_APPLICATION_ID: '111111111111111111',
    DISCORD_TOKEN: 'a-token',
    SITE: { answer: async () => null },
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
      expect(new Headers(init?.headers).get('authorization')).toBe('Bot a-token')
      return Response.json({ username: 'SalvageUnion.io', id: '1' }, { status: 200 })
    })

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as { ok: boolean; botUser: string }

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

  test.each([
    ['a Discord outage', 500],
    ['a rate limit', 429],
  ])('503s on %s, reporting the status without retrying', async (_label, status) => {
    let calls = 0
    stubFetch(async () => {
      calls++
      return Response.json({ message: 'nope', retry_after: 1, global: false }, { status })
    })

    const res = await worker.fetch(healthRequest(), envWith(), ctx)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(503)
    expect(body.discordStatus).toBe(status)
    // A probe reports what Discord said now; it never waits out a retry.
    expect(calls).toBe(1)
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

  test('503s without the SITE binding, without calling Discord', async () => {
    // Every Game command would answer that the app cannot be reached. The
    // post-deploy smoke reads this status, so a deploy missing the binding
    // fails there.
    let called = false
    stubFetch(async () => {
      called = true
      return Response.json({ username: 'bot' }, { status: 200 })
    })

    const res = await worker.fetch(healthRequest(), envWith({ SITE: undefined }), ctx)
    const body = (await res.json()) as {
      ok: boolean
      reason: string
      configured: Record<string, boolean>
    }

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.reason).toContain('site service binding')
    expect(body.configured.site).toBe(false)
    expect(called).toBe(false)
  })

  test('only answers GET /health — any other path falls through to 405', async () => {
    const res = await worker.fetch(new Request('https://bot.example/healthz'), envWith(), ctx)
    expect(res.status).toBe(405)
  })
})
