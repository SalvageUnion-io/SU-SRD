import { Database } from 'bun:sqlite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import type { SessionAnswer } from '../../lib/auth/paths'
import { AUTH_PATHS } from '../../lib/auth/paths'
import type { AuthDeps } from '../auth/index'
import { discordAvatar, handleAuth, identityOf } from '../auth/index'
import type { AuthSql } from '../auth/store'
import { d1Sql } from '../auth/store'
import type { Env } from '../env'
import { testDb } from '../shared/__tests__/d1'
import { worker } from './worker'

/**
 * Sign-in on the Worker (`src/worker/auth/`): the test seam's gate, sessions
 * in the cookie, who it signs in, and Discord's round trip.
 */

const ORIGIN = 'https://salvageunion.io'
/** An account id `signInAs` mints. */
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

type Call = { url: string; authorization: string | null; body: unknown }
// The happy-dom preload's fetch classes drop `Cookie` and `Set-Cookie`; the
// Worker runs on the runtime's own, so this file does too.
const happyDom: Partial<typeof NATIVE_FETCH_GLOBALS> = {}
beforeAll(() => {
  for (const key of Object.keys(NATIVE_FETCH_GLOBALS) as (keyof typeof NATIVE_FETCH_GLOBALS)[])
    Object.assign(happyDom, { [key]: globalThis[key] })
  Object.assign(globalThis, NATIVE_FETCH_GLOBALS)
})
afterAll(() => {
  Object.assign(globalThis, happyDom)
})

let calls: Call[]
let discordUser: Record<string, unknown>

beforeEach(() => {
  calls = []
  discordUser = { id: '80351110224678912', username: 'rae', global_name: 'Rae Voss', avatar: null }
  spyOn(globalThis, 'fetch').mockImplementation((async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const request = new Request(input, init)
    const url = request.url
    const authorization = request.headers.get('authorization')
    calls.push({ url, authorization, body: await request.text() })
    if (url === 'https://discord.com/api/oauth2/token')
      return Response.json({ access_token: 'discord-token', token_type: 'Bearer' })
    if (url === 'https://discord.com/api/users/@me') return Response.json(discordUser)
    return new Response('unexpected', { status: 500 })
  }) as unknown as typeof fetch)
})

afterEach(() => {
  ;(globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore()
})

/** `bun:sqlite` as the store's slice of D1. */
function bunAuthSql(db: Database): AuthSql {
  db.run('pragma foreign_keys = on')
  return {
    async run(query, ...bindings) {
      db.query(query).run(...bindings)
    },
    async first<Row>(query: string, ...bindings: (string | number | null)[]) {
      return (db.query(query).get(...bindings) as Row | null) ?? null
    },
  }
}

let removed: unknown[]
beforeEach(() => {
  removed = []
})

function deps(overrides: Partial<AuthDeps> = {}): AuthDeps {
  return {
    sql: bunAuthSql(new Database(':memory:')),
    removeAccount: async (who) => {
      removed.push(who)
      return null
    },
    testAuth: true,
    discord: { clientId: 'client', clientSecret: 'secret' },
    ...overrides,
  }
}

function post(path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const cookieOf = (res: Response) => res.headers.get('set-cookie')?.split(';')[0] ?? ''

async function answer(request: Request, d: AuthDeps): Promise<Response> {
  const res = await handleAuth(request, d)
  if (res === null) throw new Error(`no answer for ${request.url}`)
  return res
}

const ACCOUNT = { email: 'pilot@example.com', password: 'pass-1' }

async function signedUp(d: AuthDeps): Promise<string> {
  const res = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signUp' }), d)
  expect(res.status).toBe(204)
  return cookieOf(res)
}

describe('the test seam', () => {
  it('is no route at all without TEST_AUTH', async () => {
    expect(await handleAuth(post(AUTH_PATHS.testSignIn, ACCOUNT), deps({ testAuth: false }))).toBe(
      null
    )
  })

  it("is never on in production's wrangler.jsonc", async () => {
    const config = await Bun.file(new URL('../../../wrangler.jsonc', import.meta.url)).text()
    expect(config).not.toMatch(/"TEST_AUTH"\s*:/)
  })

  it('signs up once, and signs in again only with the same password', async () => {
    const d = deps()
    expect(await signedUp(d)).toStartWith('su_session=')
    const again = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signUp' }), d)
    expect(again.status).toBe(409)
    const wrong = { ...ACCOUNT, password: 'nope', flow: 'signIn' }
    expect((await answer(post(AUTH_PATHS.testSignIn, wrong), d)).status).toBe(401)
    const right = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signIn' }), d)
    expect(right.status).toBe(204)
  })

  it('refuses a POST from another origin', async () => {
    const res = await answer(
      post(AUTH_PATHS.testSignIn, ACCOUNT, { origin: 'https://evil.example' }),
      deps()
    )
    expect(res.status).toBe(403)
  })
})

describe('the session', () => {
  it('answers who the cookie signs in, the same account on every sign-in', async () => {
    const d = deps()
    const cookie = await signedUp(d)
    const res = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.session}`, { headers: { cookie } }),
      d
    )
    expect(res.status).toBe(200)
    const { account, person } = (await res.json()) as SessionAnswer
    expect(account).toMatch(ACCOUNT_ID)
    // The rooms' name for a test account: the stand-in `identityOf` gives.
    expect(person).toMatch(/^test:[0-9a-f]{64}$/)
    const again = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signIn' }), d)
    const second = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.session}`, { headers: { cookie: cookieOf(again) } }),
      d
    )
    expect(((await second.json()) as SessionAnswer).account).toBe(account)
  })

  it('is a 401 without a cookie, or with one the store does not know', async () => {
    const d = deps()
    expect((await answer(new Request(`${ORIGIN}${AUTH_PATHS.session}`), d)).status).toBe(401)
    const forged = new Request(`${ORIGIN}${AUTH_PATHS.session}`, {
      headers: { cookie: 'su_session=forged' },
    })
    const res = await answer(forged, d)
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('ends at sign-out', async () => {
    const d = deps()
    const cookie = await signedUp(d)
    const out = await answer(post(AUTH_PATHS.signOut, undefined, { cookie }), d)
    expect(out.status).toBe(204)
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
    const after = new Request(`${ORIGIN}${AUTH_PATHS.session}`, { headers: { cookie } })
    expect((await answer(after, d)).status).toBe(401)
  })

  it('is HttpOnly, SameSite=Lax and Secure on https', async () => {
    const res = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signUp' }), deps())
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Lax; Secure$/)
  })
})

describe('identityOf', () => {
  it("names the cookie's account, and an admin by ADMIN_DISCORD_IDS", async () => {
    const SHARED = testDb()
    const d = deps({ sql: d1Sql(SHARED) })
    const start = await answer(new Request(`${ORIGIN}${AUTH_PATHS.signIn}`), d)
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state')
    const back = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=${state}`, {
        headers: { cookie: cookieOf(start) },
      }),
      d
    )
    const session = back.headers.getSetCookie().find((c) => c.startsWith('su_session='))
    const request = new Request(`${ORIGIN}/x`, {
      headers: { cookie: session?.split(';')[0] ?? '' },
    })
    expect(await identityOf(request, { SHARED })).toEqual({
      accountId: expect.stringMatching(ACCOUNT_ID),
      discordId: '80351110224678912',
      admin: false,
    })
    const admin = await identityOf(request, { SHARED, ADMIN_DISCORD_IDS: '1, 80351110224678912' })
    expect(admin?.admin).toBe(true)
    expect(await identityOf(new Request(`${ORIGIN}/x`), { SHARED })).toBeNull()
  })

  it('gives a test account a stable stand-in Discord id, never an admin', async () => {
    const SHARED = testDb()
    const d = deps({ sql: d1Sql(SHARED) })
    const cookie = await signedUp(d)
    const request = new Request(`${ORIGIN}/x`, { headers: { cookie } })
    const env = { SHARED, ADMIN_DISCORD_IDS: 'test:' }
    const identity = await identityOf(request, env)
    expect(identity).toEqual({
      accountId: expect.stringMatching(ACCOUNT_ID),
      discordId: expect.stringMatching(/^test:[0-9a-f]{64}$/),
      admin: false,
    })
    expect((await identityOf(request, env))?.discordId).toBe(identity?.discordId)
  })
})

describe("Discord's round trip", () => {
  it('is a 503 where no OAuth client is set', async () => {
    const res = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.signIn}`),
      deps({ discord: undefined })
    )
    expect(res.status).toBe(503)
  })

  it('goes to Discord with PKCE and comes back to a path on this site only', async () => {
    const res = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.signIn}?to=${encodeURIComponent('//evil.example')}`),
      deps()
    )
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location') ?? '')
    expect(to.origin).toBe('https://discord.com')
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}${AUTH_PATHS.callback}`)
    expect(to.searchParams.get('code_challenge_method')).toBe('S256')
    expect(to.searchParams.get('scope')).toBe('identify email')
    const saved = cookieOf(res).replace('su_oauth=', '')
    const value = JSON.parse(atob(saved.replace(/-/g, '+').replace(/_/g, '/')))
    expect(value.state).toBe(to.searchParams.get('state'))
    expect(value.to).toBe('/build/')
  })

  it('refuses a way back that a browser would read as another host', async () => {
    const d = deps()
    for (const to of [
      '/\t/evil.example',
      '/\\evil.example',
      '/\n/evil.example',
      'https://evil.example',
    ]) {
      const res = await answer(
        new Request(`${ORIGIN}${AUTH_PATHS.signIn}?to=${encodeURIComponent(to)}`),
        d
      )
      const saved = cookieOf(res).replace('su_oauth=', '')
      expect(JSON.parse(atob(saved.replace(/-/g, '+').replace(/_/g, '/'))).to).toBe('/build/')
    }
  })

  it('signs in on the way back, and lands on the invite it started from', async () => {
    const d = deps()
    const start = await answer(
      new Request(
        `${ORIGIN}${AUTH_PATHS.signIn}?to=${encodeURIComponent('/play/invite/abc?join=1')}`
      ),
      d
    )
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state')
    const back = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=${state}`, {
        headers: { cookie: cookieOf(start) },
      }),
      d
    )
    expect(back.status).toBe(302)
    expect(back.headers.get('location')).toBe('/play/invite/abc?join=1')
    const session = back.headers.getSetCookie().find((c) => c.startsWith('su_session='))
    expect(session).toBeDefined()
  })

  it('a state that does not match signs nobody in', async () => {
    const d = deps()
    const start = await answer(new Request(`${ORIGIN}${AUTH_PATHS.signIn}`), d)
    const back = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=forged`, {
        headers: { cookie: cookieOf(start) },
      }),
      d
    )
    expect(back.headers.get('location')).toBe('/build/')
    expect(back.headers.getSetCookie().some((c) => c.startsWith('su_session='))).toBe(false)
  })
})

describe('a Preview signing in through the callback origin', () => {
  const PREVIEW = 'https://pr-7-su-srd.alxjrvs.workers.dev'

  it("goes to Discord with the callback origin's redirect, its own host in the state", async () => {
    const d = deps({ callbackOrigin: ORIGIN })
    const start = await answer(new Request(`${PREVIEW}${AUTH_PATHS.signIn}`), d)
    const to = new URL(start.headers.get('location') ?? '')
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}${AUTH_PATHS.callback}`)
    expect(to.searchParams.get('state')).toStartWith('pr-7-su-srd.alxjrvs.workers.dev~')
  })

  it('is handed back to the Preview, which signs in there', async () => {
    const preview = deps({ callbackOrigin: ORIGIN })
    const start = await answer(new Request(`${PREVIEW}${AUTH_PATHS.signIn}`), preview)
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state') ?? ''
    const query = `?code=c&state=${encodeURIComponent(state)}`
    const handed = await answer(new Request(`${ORIGIN}${AUTH_PATHS.callback}${query}`), deps())
    expect(handed.status).toBe(302)
    expect(handed.headers.get('location')).toBe(`${PREVIEW}${AUTH_PATHS.callback}${query}`)
    expect(calls).toHaveLength(0)
    const back = await answer(
      new Request(handed.headers.get('location') ?? '', { headers: { cookie: cookieOf(start) } }),
      preview
    )
    expect(back.headers.getSetCookie().some((c) => c.startsWith('su_session='))).toBe(true)
    const exchange = calls.find((c) => c.url === 'https://discord.com/api/oauth2/token')
    expect(String(exchange?.body)).toContain(
      `redirect_uri=${encodeURIComponent(`${ORIGIN}${AUTH_PATHS.callback}`)}`
    )
  })

  it('hands a code on to no host but a Preview', async () => {
    for (const host of ['evil.example', 'pr-7-su-srd.alxjrvs.workers.dev.evil.example']) {
      const res = await answer(
        new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=${host}~s`),
        deps()
      )
      expect(res.headers.get('location')).toBe('/build/')
    }
  })
})

describe('discordAvatar', () => {
  it("draws Discord's CDN avatar, animated or not, or its default", () => {
    const id = '80351110224678912'
    expect(discordAvatar({ id, username: 'r', avatar: 'abc' })).toBe(
      `https://cdn.discordapp.com/avatars/${id}/abc.png`
    )
    expect(discordAvatar({ id, username: 'r', avatar: 'a_abc' })).toEndWith('/a_abc.gif')
    expect(discordAvatar({ id, username: 'r', discriminator: '1337' })).toBe(
      'https://cdn.discordapp.com/embed/avatars/2.png'
    )
  })
})

describe('what goes wrong', () => {
  it('a malformed OAuth cookie signs nobody in', async () => {
    const back = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=s`, {
        headers: { cookie: 'su_oauth=%%%not-base64' },
      }),
      deps()
    )
    expect(back.status).toBe(302)
    expect(back.headers.getSetCookie().some((c) => c.startsWith('su_session='))).toBe(false)
  })

  it("logs Discord's reason when it refuses the code", async () => {
    const errors = spyOn(console, 'error').mockImplementation(() => undefined)
    ;(
      globalThis.fetch as unknown as { mockImplementation: (f: unknown) => void }
    ).mockImplementation(async () =>
      Response.json(
        { error: 'invalid_client', error_description: 'Invalid client secret' },
        { status: 401 }
      )
    )
    try {
      const d = deps()
      const start = await answer(new Request(`${ORIGIN}${AUTH_PATHS.signIn}`), d)
      const state = new URL(start.headers.get('location') ?? '').searchParams.get('state')
      const back = await answer(
        new Request(`${ORIGIN}${AUTH_PATHS.callback}?code=c&state=${state}`, {
          headers: { cookie: cookieOf(start) },
        }),
        d
      )
      expect(back.headers.get('location')).toBe('/build/')
      expect(errors.mock.calls[0]?.[0]).toBe(
        'Discord sign-in failed: invalid_client Invalid client secret'
      )
    } finally {
      errors.mockRestore()
    }
  })

  it('the test seam wants an email and a password', async () => {
    const res = await answer(post(AUTH_PATHS.testSignIn, { email: '', password: 'x' }), deps())
    expect(res.status).toBe(400)
    expect((await answer(post(AUTH_PATHS.testSignIn), deps())).status).toBe(400)
  })

  it('answers no other path, nor the wrong method', async () => {
    const d = deps()
    expect(await handleAuth(new Request(`${ORIGIN}/auth/elsewhere`), d)).toBeNull()
    expect(await handleAuth(new Request(`${ORIGIN}${AUTH_PATHS.signOut}`), d)).toBeNull()
    expect(await handleAuth(post(AUTH_PATHS.session), d)).toBeNull()
  })
})

describe('the Worker', () => {
  it('serves sign-in under /auth/ from its bindings and secrets', async () => {
    const env = {
      SHARED: testDb(),
      DISCORD_CLIENT_ID: 'client',
      DISCORD_CLIENT_SECRET: 'secret',
      TEST_AUTH: 'true',
    } as unknown as Env
    const start = await worker.fetch(new Request(`${ORIGIN}${AUTH_PATHS.signIn}`), env)
    expect(new URL(start.headers.get('location') ?? '').origin).toBe('https://discord.com')
    const seam = await worker.fetch(
      post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signUp' }),
      env
    )
    expect(seam.status).toBe(204)
    const bare = { ...env, DISCORD_CLIENT_ID: undefined, TEST_AUTH: undefined } as unknown as Env
    expect((await worker.fetch(new Request(`${ORIGIN}${AUTH_PATHS.signIn}`), bare)).status).toBe(
      503
    )
  })
})

describe('deleting the account', () => {
  it('removes what it holds as the signed-in player, then ends every session it has', async () => {
    const d = deps({ adminIds: 'test:' })
    const cookie = await signedUp(d)
    const elsewhere = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signIn' }), d)
    const res = await answer(post(AUTH_PATHS.deleteAccount, undefined, { cookie }), d)
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(removed).toEqual([
      {
        accountId: expect.stringMatching(ACCOUNT_ID),
        discordId: expect.stringMatching(/^test:[0-9a-f]{64}$/),
        admin: false,
      },
    ])
    for (const c of [cookie, cookieOf(elsewhere)]) {
      const after = new Request(`${ORIGIN}${AUTH_PATHS.session}`, { headers: { cookie: c } })
      expect((await answer(after, d)).status).toBe(401)
    }
  })

  it('keeps the account and its sessions when the rooms refuse, with their reason', async () => {
    const d = deps({
      removeAccount: async () => Response.json({ errorMessage: 'unreachable' }, { status: 409 }),
    })
    const cookie = await signedUp(d)
    const res = await answer(post(AUTH_PATHS.deleteAccount, undefined, { cookie }), d)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ errorMessage: 'unreachable' })
    const after = new Request(`${ORIGIN}${AUTH_PATHS.session}`, { headers: { cookie } })
    expect((await answer(after, d)).status).toBe(200)
  })

  it('is a 401 signed out, and refused from another origin', async () => {
    expect((await answer(post(AUTH_PATHS.deleteAccount), deps())).status).toBe(401)
    const foreign = post(AUTH_PATHS.deleteAccount, undefined, { origin: 'https://evil.example' })
    expect((await answer(foreign, deps())).status).toBe(403)
  })
})
