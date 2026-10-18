import { afterEach, describe, expect, test } from 'bun:test'
import { createSiteClient, interpret } from '../play/client'

/**
 * The bot's Cantina client.
 *
 * Two things are worth pinning here and neither needs a network: that an
 * unconfigured client degrades to `unavailable` without making a request, and
 * that every wire response maps onto exactly one of the three result kinds — because the
 * commands branch exhaustively on those, and an unmapped response would show a
 * player a permissions error for what was actually an outage.
 */

describe('an unconfigured client', () => {
  test.each([
    ['neither value', {}],
    ['no secret', { siteUrl: 'https://x.convex.site' }],
    ['no url', { botSecret: 'shh' }],
    ['a blank url', { siteUrl: '', botSecret: 'shh' }],
  ])('with %s, answers unavailable without a request', async (_label, config) => {
    const realFetch = globalThis.fetch
    let called = false
    globalThis.fetch = (() => {
      called = true
      return Promise.reject(new Error('no request expected'))
    }) as unknown as typeof fetch
    try {
      const client = createSiteClient(config)
      const result = await client.me('d1')
      expect(result.kind).toBe('unavailable')
      expect((await client.sheet('d1', 'pilots', 'p1')).kind).toBe('unavailable')
      expect(called).toBe(false)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})

describe('interpret', () => {
  test('an ok payload becomes a value', () => {
    expect(interpret(200, { ok: true, games: [] })).toEqual({
      kind: 'ok',
      value: { ok: true, games: [] },
    })
  })

  test('a denial keeps its reason so the command can word it properly', () => {
    expect(interpret(200, { ok: false, reason: 'unlinked', message: 'nope' })).toEqual({
      kind: 'denied',
      reason: 'unlinked',
      message: 'nope',
    })
    // `/su bind`'s refusal is a denial too, never an outage.
    expect(interpret(200, { ok: false, reason: 'forbidden', message: 'not yours' })).toEqual({
      kind: 'denied',
      reason: 'forbidden',
      message: 'not yours',
    })
  })

  test('a bad credential is an outage, not a permissions problem', () => {
    // 401 means the BOT is misconfigured. Telling a player they lack
    // permission would send them chasing an Organizer over a deploy fault.
    expect(interpret(401, null).kind).toBe('unavailable')
    // 404 is the deployment having the route switched off — same class of
    // fault, same answer.
    expect(interpret(404, null).kind).toBe('unavailable')
  })

  test('any other non-200 is unavailable', () => {
    expect(interpret(500, null).kind).toBe('unavailable')
    expect(interpret(502, 'gateway error').kind).toBe('unavailable')
  })

  test('an unrecognised 200 body is unavailable rather than silently ok', () => {
    // Failing closed matters: treating an unknown shape as success would render
    // a card full of "—" and look like real, empty data.
    expect(interpret(200, null).kind).toBe('unavailable')
    expect(interpret(200, { ok: false }).kind).toBe('unavailable')
    expect(interpret(200, { ok: false, reason: 'invented-reason' }).kind).toBe('unavailable')
  })
})

/**
 * The transport itself.
 *
 * `fetch` is stubbed on `globalThis` rather than mocked as a module: the client
 * deliberately uses the platform `fetch` and no HTTP library, so there is no
 * module to mock, and a global stub is both the smallest seam and the one that
 * proves the real call shape — URL, method, bearer header, JSON body.
 */

type FetchArgs = { url: string; init: RequestInit }

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(responder: () => Promise<Response> | Response): FetchArgs[] {
  const calls: FetchArgs[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(responder())
  }) as unknown as typeof fetch
  return calls
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const CONFIG = { siteUrl: 'https://x.convex.site', botSecret: 'shh' }

describe('the transport', () => {
  test('posts to /bot/<op> with the bearer credential and a JSON body', async () => {
    const calls = stubFetch(() => jsonResponse({ ok: true, games: [] }))
    const client = createSiteClient(CONFIG)
    const result = await client.games('discord-1')

    expect(result.kind).toBe('ok')
    expect(calls[0]?.url).toBe('https://x.convex.site/bot/games')
    expect(calls[0]?.init.method).toBe('POST')
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer shh')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ discordId: 'discord-1' })
  })

  test('strips a trailing slash rather than emitting a double one', async () => {
    const calls = stubFetch(() => jsonResponse({ ok: true }))
    await createSiteClient({ ...CONFIG, siteUrl: 'https://x.convex.site///' }).me('d1')
    expect(calls[0]?.url).toBe('https://x.convex.site/bot/me')
  })

  test.each([
    ['me', (c: ReturnType<typeof createSiteClient>) => c.me('d1'), { discordId: 'd1' }],
    ['games', (c: ReturnType<typeof createSiteClient>) => c.games('d1'), { discordId: 'd1' }],
    [
      'mine',
      (c: ReturnType<typeof createSiteClient>) => c.mineForAutocomplete('d1'),
      { discordId: 'd1' },
    ],
    [
      'sheet',
      (c: ReturnType<typeof createSiteClient>) => c.sheet('d1', 'pilots', 'p1'),
      { discordId: 'd1', table: 'pilots', entityId: 'p1' },
    ],
    [
      'games',
      (c: ReturnType<typeof createSiteClient>) => c.gamesForAutocomplete('d1'),
      { discordId: 'd1' },
    ],
    [
      'bindChannel',
      (c: ReturnType<typeof createSiteClient>) => c.bindChannel('d1', 'ch1', 'g1'),
      { discordId: 'd1', channelId: 'ch1', game: 'g1' },
    ],
    [
      'bindChannel',
      (c: ReturnType<typeof createSiteClient>) => c.bindChannel('d1', 'ch1', 'g1', 'salvage-run'),
      { discordId: 'd1', channelId: 'ch1', channelName: 'salvage-run', game: 'g1' },
    ],
    [
      'bindChannel',
      // Solo play: no `game` key at all, which the server's `v.optional` takes.
      (c: ReturnType<typeof createSiteClient>) => c.bindChannel('d1', 'ch1', null),
      { discordId: 'd1', channelId: 'ch1' },
    ],
    [
      'unbindChannel',
      (c: ReturnType<typeof createSiteClient>) => c.unbindChannel('d1', 'ch1'),
      { discordId: 'd1', channelId: 'ch1' },
    ],
  ])('%s sends the arguments the server declares', async (op, call, expected) => {
    // Guards the one genuinely untyped seam in the system: these payloads are
    // validated by Convex's own arg validators at the far end, so a renamed
    // field would fail at runtime rather than at build.
    const calls = stubFetch(() => jsonResponse({ ok: true }))
    const client = createSiteClient(CONFIG)
    if (!client) throw new Error('expected a client')
    await call(client)

    expect(calls[0]?.url).toBe(`https://x.convex.site/bot/${op}`)
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(expected)
  })

  test('a thrown fetch is an outage, not a crash', async () => {
    stubFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    const result = await createSiteClient(CONFIG).me('d1')
    expect(result.kind).toBe('unavailable')
  })

  test('a non-JSON body is an outage rather than a parse error', async () => {
    // A proxy or an error page in front of the deployment returns HTML; that
    // must not escape as a SyntaxError from inside a slash command.
    stubFetch(() => new Response('<html>502</html>', { status: 200 }))
    const result = await createSiteClient(CONFIG).me('d1')
    expect(result.kind).toBe('unavailable')
  })

  test('a 401 reports a credential problem', async () => {
    stubFetch(() => jsonResponse({ error: 'unauthorized' }, 401))
    const result = await createSiteClient(CONFIG).me('d1')
    expect(result).toMatchObject({ kind: 'unavailable' })
    expect((result as { message: string }).message).toContain('credentials')
  })
})
