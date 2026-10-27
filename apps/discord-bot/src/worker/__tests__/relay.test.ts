import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import type { PostRollRelayResponse } from 'game-domain/botWire'
import { BOT_RELAY_POST_ROLL_PATH, BOT_RELAY_POST_STOP_PATH } from 'game-domain/botWire'
import { Relay } from '../relay'
import { withFetchStub } from './stubFetch'

/**
 * The relay: the site Worker posting a Play roll or a Stop Sign into a bound
 * channel through the bot, over its service binding (`src/worker/relay.ts`).
 * Discord is `fetch`, stubbed per test.
 */

const stubFetch = withFetchStub()

function env(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_PUBLIC_KEY: 'ab'.repeat(32),
    DISCORD_APPLICATION_ID: '111111111111111111',
    DISCORD_TOKEN: 'a-token',
    ...overrides,
  } as Env
}

/** The site's `BOT` binding, as the site calls it (`relayUrl`). */
const relay = (request: Request, e: Env = env()) => new Relay({} as never, e).fetch(request)

function relayRequest(body: unknown, path = BOT_RELAY_POST_ROLL_PATH): Request {
  return new Request(`https://relay${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

    const res = await relay(relayRequest(ROLL))
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
    const res = await relay(relayRequest(ROLL))
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
    const body = (await (await relay(relayRequest(ROLL))).json()) as PostRollRelayResponse
    expect(body).toMatchObject({ ok: false, status: 404 })
  })

  test.each([
    [
      'another refusal names its status',
      400,
      { message: 'Bad', code: 50035 },
      'refused the post (400)',
    ],
    ['a server error names its status', 500, 'oops', 'refused the post (500)'],
    [
      'a rate limit says to wait',
      429,
      { message: 'Slow', retry_after: 1, global: false },
      'rate-limiting',
    ],
  ])('%s', async (_label, status, body, words) => {
    stubFetch(async () =>
      typeof body === 'string'
        ? new Response(body, { status })
        : Response.json(body, {
            status,
            headers: { 'retry-after': '1', 'x-ratelimit-scope': 'user' },
          })
    )
    const answered = (await (await relay(relayRequest(ROLL))).json()) as PostRollRelayResponse
    expect(answered.ok).toBe(false)
    if (answered.ok) return
    expect(answered.message).toContain(words)
  })

  test('Discord out of reach is said, not thrown', async () => {
    stubFetch(async () => {
      throw new Error('connect ECONNREFUSED')
    })
    const answered = (await (await relay(relayRequest(ROLL))).json()) as PostRollRelayResponse
    expect(answered).toMatchObject({
      ok: false,
      status: null,
      message: 'Discord could not be reached.',
    })
  })

  test('answers no other path or method', async () => {
    expect((await relay(relayRequest(ROLL, '/relay/elsewhere'))).status).toBe(404)
    const get = new Request(`https://relay${BOT_RELAY_POST_ROLL_PATH}`)
    expect((await relay(get)).status).toBe(404)
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
    const res = await relay(relayRequest(body))
    expect(res.status).toBe(400)
    expect(((await res.json()) as PostRollRelayResponse).ok).toBe(false)
    expect(called).toBe(false)
  })

  test('an unknown table is a failure with a reason, not a crash', async () => {
    const res = await relay(relayRequest({ ...ROLL, tableName: 'No Such Table' }))
    const body = (await res.json()) as PostRollRelayResponse
    expect(res.status).toBe(422)
    expect(body.ok).toBe(false)
  })
})

describe('the post-stop relay', () => {
  const stop = (body: unknown) => relayRequest(body, BOT_RELAY_POST_STOP_PATH)

  test("posts the Stop Sign's fixed words to the channel", async () => {
    let sent: { url: string; body: Record<string, unknown> } | null = null
    stubFetch(async (input, init) => {
      sent = { url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> }
      return Response.json({ id: 'msg-2' }, { status: 200 })
    })

    const res = await relay(stop({ channelId: ROLL.channelId }))
    expect((await res.json()) as PostRollRelayResponse).toEqual({ ok: true, messageId: 'msg-2' })
    if (sent === null) throw new Error('nothing was posted')
    const posted = sent as { url: string; body: Record<string, unknown> }
    expect(posted.url).toBe(`https://discord.com/api/v10/channels/${ROLL.channelId}/messages`)
    expect(posted.body.flags).toBe(MessageFlags.IsComponentsV2)
    expect(JSON.stringify(posted.body.components)).toContain('the game is paused')
  })

  test('refuses a channel that is not a snowflake', async () => {
    const res = await relay(stop({ channelId: 'general' }))
    expect(res.status).toBe(400)
  })

  test('a Discord refusal comes back in words', async () => {
    stubFetch(async () =>
      Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 })
    )
    const body = (await (
      await relay(stop({ channelId: ROLL.channelId }))
    ).json()) as PostRollRelayResponse
    expect(body).toMatchObject({ ok: false, status: 403 })
  })
})
