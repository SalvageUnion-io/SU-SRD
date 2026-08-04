import { afterEach, describe, expect, test } from 'bun:test'
import { createItunClient, interpret } from '../itun/client.js'

/**
 * The bot's ITUN client.
 *
 * Two things are worth pinning here and neither needs a network: that an
 * unconfigured bot produces **no client at all** (Solo mode), and that every
 * wire response maps onto exactly one of the three result kinds — because the
 * commands branch exhaustively on those, and an unmapped response would show a
 * player a permissions error for what was actually an outage.
 */

describe('createItunClient', () => {
  test('is null unless BOTH the url and the secret are present', () => {
    // Solo mode is the default, and it is a null client rather than a throwing
    // stub so every call site has to acknowledge it at compile time.
    expect(createItunClient({})).toBeNull()
    expect(createItunClient({ siteUrl: 'https://x.convex.site' })).toBeNull()
    expect(createItunClient({ botSecret: 'shh' })).toBeNull()
    expect(createItunClient({ siteUrl: '', botSecret: 'shh' })).toBeNull()
  })

  test('is a client when both are present', () => {
    expect(createItunClient({ siteUrl: 'https://x.convex.site', botSecret: 'shh' })).not.toBeNull()
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
    // an embed full of "—" and look like real, empty data.
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
    const client = createItunClient(CONFIG)
    const result = await client?.games('discord-1')

    expect(result?.kind).toBe('ok')
    expect(calls[0]?.url).toBe('https://x.convex.site/bot/games')
    expect(calls[0]?.init.method).toBe('POST')
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer shh')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ discordId: 'discord-1' })
  })

  test('strips a trailing slash rather than emitting a double one', async () => {
    const calls = stubFetch(() => jsonResponse({ ok: true }))
    await createItunClient({ ...CONFIG, siteUrl: 'https://x.convex.site///' })?.me('d1')
    expect(calls[0]?.url).toBe('https://x.convex.site/bot/me')
  })

  test.each([
    [
      'me',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.me('d1'),
      { discordId: 'd1' },
    ],
    [
      'shelf',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.shelf('d1'),
      { discordId: 'd1' },
    ],
    [
      'channel',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.channel('d1', 'c1'),
      { discordId: 'd1', channelId: 'c1' },
    ],
    [
      'crew',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.crew('d1', 'c1'),
      { discordId: 'd1', channelId: 'c1' },
    ],
    [
      'sheet',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.sheet('d1', 'c1', 'pilots', 'p1'),
      { discordId: 'd1', channelId: 'c1', table: 'pilots', entityId: 'p1' },
    ],
    [
      'bind',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.bind('d1', 'c1', 'g1'),
      { discordId: 'd1', channelId: 'c1', gameId: 'g1' },
    ],
    [
      'unbind',
      (c: NonNullable<ReturnType<typeof createItunClient>>) => c.unbind('d1', 'c1'),
      { discordId: 'd1', channelId: 'c1' },
    ],
    [
      'recordRoll',
      (c: NonNullable<ReturnType<typeof createItunClient>>) =>
        c.recordRoll('d1', 'c1', 'Rolled', { t: 1 }),
      { discordId: 'd1', channelId: 'c1', description: 'Rolled', result: { t: 1 } },
    ],
  ])('%s sends the arguments the server declares', async (op, call, expected) => {
    // Guards the one genuinely untyped seam in the system: these payloads are
    // validated by Convex's own arg validators at the far end, so a renamed
    // field would fail at runtime rather than at build.
    const calls = stubFetch(() => jsonResponse({ ok: true }))
    const client = createItunClient(CONFIG)
    if (!client) throw new Error('expected a client')
    await call(client)

    expect(calls[0]?.url).toBe(`https://x.convex.site/bot/${op}`)
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(expected)
  })

  test('a thrown fetch is an outage, not a crash', async () => {
    stubFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    const result = await createItunClient(CONFIG)?.crew('d1', 'c1')
    expect(result?.kind).toBe('unavailable')
  })

  test('a non-JSON body is an outage rather than a parse error', async () => {
    // A proxy or an error page in front of the deployment returns HTML; that
    // must not escape as a SyntaxError from inside a slash command.
    stubFetch(() => new Response('<html>502</html>', { status: 200 }))
    const result = await createItunClient(CONFIG)?.crew('d1', 'c1')
    expect(result?.kind).toBe('unavailable')
  })

  test('a 401 reports a credential problem', async () => {
    stubFetch(() => jsonResponse({ error: 'unauthorized' }, 401))
    const result = await createItunClient(CONFIG)?.me('d1')
    expect(result).toMatchObject({ kind: 'unavailable' })
    expect((result as { message: string }).message).toContain('credentials')
  })
})
