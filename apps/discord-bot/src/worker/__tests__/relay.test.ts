import { afterEach, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import type { PostRollRelayResponse } from 'game-domain/botWire'
import { BOT_RELAY_POST_ROLL_PATH } from 'game-domain/botWire'
import worker from '../index'

/**
 * The relay: Convex posting a Play roll into a bound channel through the bot
 * (`src/worker/relay.ts`). Discord is `fetch`, stubbed per test.
 */

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = handler as typeof fetch
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
    DISCORD_APPLICATION_ID: '111111111111111111',
    DISCORD_TOKEN: 'a-token',
    CANTINA_CONVEX_SITE_URL: 'https://x.convex.site',
    CANTINA_BOT_SECRET: 'a-secret',
    ...overrides,
  } as Env
}

const ctx = { waitUntil: () => {} }

function relayRequest(body: unknown, secret = 'a-secret'): Request {
  return new Request(`https://bot.example${BOT_RELAY_POST_ROLL_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ROLL = {
  channelId: '123456789012345678',
  tableName: 'Core Mechanic',
  rolls: [14],
  roller: 'Roach-Boy',
  ownerDiscordId: '999',
}

describe('the post-roll relay', () => {
  test('posts the roll card to the channel with the bot token', async () => {
    let posted: { url: string; auth: string | null; body: Record<string, unknown> } | null = null
    stubFetch(async (input, init) => {
      posted = {
        url: String(input),
        auth: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }
      return Response.json({ id: 'msg-1' }, { status: 200 })
    })

    const res = await worker.fetch(relayRequest(ROLL), env(), ctx)
    const body = (await res.json()) as PostRollRelayResponse

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, messageId: 'msg-1' })
    if (posted === null) throw new Error('nothing was posted')
    const sent = posted as { url: string; auth: string | null; body: Record<string, unknown> }
    expect(sent.url).toBe(`https://discord.com/api/v10/channels/${ROLL.channelId}/messages`)
    expect(sent.auth).toBe('Bot a-token')
    // The `/su roll` card: public Components V2, with the roller named.
    expect(sent.body.flags).toBe(MessageFlags.IsComponentsV2)
    const json = JSON.stringify(sent.body.components)
    expect(json).toContain('rolled by Roach-Boy')
    expect(json).toContain('Roll again')
    expect(json).toContain('See table')
  })

  test('a Discord refusal comes back worded for the roller', async () => {
    stubFetch(async () =>
      Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 })
    )
    const res = await worker.fetch(relayRequest(ROLL), env(), ctx)
    const body = (await res.json()) as PostRollRelayResponse
    expect(body.ok).toBe(false)
    if (body.ok) return
    expect(body.status).toBe(403)
    expect(body.message).toContain('cannot post')
  })

  test('a deleted channel says so', async () => {
    stubFetch(async () =>
      Response.json({ message: 'Unknown Channel', code: 10003 }, { status: 404 })
    )
    const body = (await (
      await worker.fetch(relayRequest(ROLL), env(), ctx)
    ).json()) as PostRollRelayResponse
    expect(body).toMatchObject({ ok: false, status: 404 })
  })

  test('refuses a wrong secret, and posts nothing', async () => {
    let called = false
    stubFetch(async () => {
      called = true
      return Response.json({ id: 'x' })
    })
    const res = await worker.fetch(relayRequest(ROLL, 'not-the-secret'), env(), ctx)
    expect(res.status).toBe(401)
    expect(called).toBe(false)
  })

  test('is absent while the secret is unset', async () => {
    const res = await worker.fetch(relayRequest(ROLL), env({ CANTINA_BOT_SECRET: '' }), ctx)
    expect(res.status).toBe(404)
  })

  test.each([
    ['no channel', { ...ROLL, channelId: '' }],
    ['a die off the d20', { ...ROLL, rolls: [21] }],
    ['three dice', { ...ROLL, rolls: [1, 2, 3] }],
    ['a separator in the table name', { ...ROLL, tableName: 'Core|Mechanic' }],
  ])('refuses %s without calling Discord', async (_label, body) => {
    let called = false
    stubFetch(async () => {
      called = true
      return Response.json({ id: 'x' })
    })
    const res = await worker.fetch(relayRequest(body), env(), ctx)
    expect(res.status).toBe(400)
    expect(((await res.json()) as PostRollRelayResponse).ok).toBe(false)
    expect(called).toBe(false)
  })

  test('an unknown table is a failure with a reason, not a crash', async () => {
    const res = await worker.fetch(
      relayRequest({ ...ROLL, tableName: 'No Such Table' }),
      env(),
      ctx
    )
    const body = (await res.json()) as PostRollRelayResponse
    expect(res.status).toBe(422)
    expect(body.ok).toBe(false)
  })
})
