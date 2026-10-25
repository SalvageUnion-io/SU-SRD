import { Database } from 'bun:sqlite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { LINK_ISSUER, SESSION_ISSUER, TOKEN_AUDIENCE } from 'game-domain/authWire'
import { bunAuthSql } from '../../../astro/build/devAuth'
import { generateAuthKey, jwksDataUri } from '../../../scripts/authKeys'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { AUTH_PATHS } from '../../lib/auth/paths'
import type { AuthDeps } from '../auth/index'
import { discordAvatar, handleAuth, identityOf } from '../auth/index'
import type { D1Like } from '../auth/store'
import { d1Sql } from '../auth/store'
import type { Env } from '../index'
import worker from '../index'

/**
 * Sign-in on the Worker (`src/worker/auth/`): the test seam's gate, sessions
 * in the cookie, the token Convex reads, and Discord's round trip.
 */

const ORIGIN = 'https://salvageunion.io'
const CONVEX = 'https://convex.example'
const KEY = await generateAuthKey()

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
    if (url === `${CONVEX}/api/mutation`)
      return Response.json({ status: 'success', value: 'user1' })
    if (url === 'https://discord.com/api/oauth2/token')
      return Response.json({ access_token: 'discord-token', token_type: 'Bearer' })
    if (url === 'https://discord.com/api/users/@me') return Response.json(discordUser)
    return new Response('unexpected', { status: 500 })
  }) as unknown as typeof fetch)
})

afterEach(() => {
  ;(globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore()
})

function deps(overrides: Partial<AuthDeps> = {}): AuthDeps {
  return {
    sql: bunAuthSql(new Database(':memory:')),
    convexUrl: CONVEX,
    signingKey: KEY,
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

function claimsOf(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? ''
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
}

/** Verifies a token against the JWKS Convex is given, as Convex does. */
async function verifies(token: string): Promise<boolean> {
  const uri = jwksDataUri(KEY)
  const { keys } = JSON.parse(atob(uri.slice(uri.indexOf(',') + 1))) as { keys: JsonWebKey[] }
  const key = await crypto.subtle.importKey(
    'jwk',
    keys[0] as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  )
  const [header, payload, signature] = token.split('.')
  const raw = Uint8Array.from(atob((signature ?? '').replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0)
  )
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    raw,
    new TextEncoder().encode(`${header}.${payload}`)
  )
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

  it('links the account to Convex with a link token', async () => {
    await signedUp(deps())
    const link = calls.find((c) => c.url === `${CONVEX}/api/mutation`)
    expect(JSON.parse(String(link?.body))).toEqual({
      path: 'accountLink:link',
      args: {},
      format: 'json',
    })
    const token = link?.authorization?.replace('Bearer ', '') ?? ''
    expect(claimsOf(token)).toMatchObject({
      iss: LINK_ISSUER,
      aud: TOKEN_AUDIENCE,
      sub: 'test:pilot@example.com',
      email: 'pilot@example.com',
    })
    expect(await verifies(token)).toBe(true)
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
  it("answers Convex's token for the cookie, its subject the Convex user and session", async () => {
    const d = deps()
    const cookie = await signedUp(d)
    const res = await answer(
      new Request(`${ORIGIN}${AUTH_PATHS.token}`, { headers: { cookie } }),
      d
    )
    expect(res.status).toBe(200)
    const { token, account } = (await res.json()) as { token: string; account: string }
    expect(account).toBe('user1')
    const claims = claimsOf(token)
    expect(claims).toMatchObject({ iss: SESSION_ISSUER, aud: TOKEN_AUDIENCE })
    expect(String(claims.sub)).toMatch(/^user1\|[0-9a-f]{16}$/)
    expect(Number(claims.exp) - Number(claims.iat)).toBe(600)
    expect(await verifies(token)).toBe(true)
  })

  it('is a 401 without a cookie, or with one the store does not know', async () => {
    const d = deps()
    expect((await answer(new Request(`${ORIGIN}${AUTH_PATHS.token}`), d)).status).toBe(401)
    const forged = new Request(`${ORIGIN}${AUTH_PATHS.token}`, {
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
    const after = new Request(`${ORIGIN}${AUTH_PATHS.token}`, { headers: { cookie } })
    expect((await answer(after, d)).status).toBe(401)
  })

  it('is HttpOnly, SameSite=Lax and Secure on https', async () => {
    const res = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signUp' }), deps())
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Lax; Secure$/)
  })
})

/** `bun:sqlite` in D1's shape, for `identityOf`, which takes the binding. */
function d1(db: Database): D1Like {
  return {
    prepare: (query) => ({
      bind: (...values) => ({
        first: async <Row>() => (db.query(query).get(...values) as Row | null) ?? null,
        run: async () => db.query(query).run(...values),
      }),
    }),
  }
}

describe('identityOf', () => {
  it("names the cookie's account, and an admin by ADMIN_DISCORD_IDS", async () => {
    const SHARED = d1(new Database(':memory:'))
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
      accountId: 'user1',
      discordId: '80351110224678912',
      admin: false,
    })
    const admin = await identityOf(request, { SHARED, ADMIN_DISCORD_IDS: '1, 80351110224678912' })
    expect(admin?.admin).toBe(true)
    expect(await identityOf(new Request(`${ORIGIN}/x`), { SHARED })).toBeNull()
  })

  it('gives a test account a stable stand-in Discord id, never an admin', async () => {
    const SHARED = d1(new Database(':memory:'))
    const d = deps({ sql: d1Sql(SHARED) })
    const cookie = await signedUp(d)
    const request = new Request(`${ORIGIN}/x`, { headers: { cookie } })
    const env = { SHARED, ADMIN_DISCORD_IDS: 'test:' }
    const identity = await identityOf(request, env)
    expect(identity).toEqual({
      accountId: 'user1',
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
    const link = calls.find((c) => c.url === `${CONVEX}/api/mutation`)
    expect(claimsOf(link?.authorization?.replace('Bearer ', '') ?? '')).toMatchObject({
      sub: 'discord:80351110224678912',
      name: 'Rae Voss',
      picture: 'https://cdn.discordapp.com/embed/avatars/5.png',
    })
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

  it('a failed link lands the player signed out where they were, and logs why', async () => {
    const errors = spyOn(console, 'error').mockImplementation(() => undefined)
    ;(
      globalThis.fetch as unknown as { mockImplementation: (f: unknown) => void }
    ).mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new Request(input, init).url
      if (url === `${CONVEX}/api/mutation`)
        return Response.json({ status: 'error', errorMessage: 'not an account' })
      if (url === 'https://discord.com/api/oauth2/token')
        return Response.json({ access_token: 'discord-token', token_type: 'Bearer' })
      return Response.json(discordUser)
    })
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
      expect(back.headers.getSetCookie().some((c) => c.startsWith('su_session='))).toBe(false)
      expect(String(errors.mock.calls[0]?.[1])).toContain('accountLink.link failed: not an account')
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
    expect(await handleAuth(post(AUTH_PATHS.token), d)).toBeNull()
  })
})

describe('the Worker', () => {
  it('serves sign-in under /auth/ from its bindings and secrets', async () => {
    const env = {
      SHARED: d1(new Database(':memory:')),
      CONVEX_URL: CONVEX,
      DISCORD_CLIENT_ID: 'client',
      DISCORD_CLIENT_SECRET: 'secret',
      AUTH_SIGNING_KEY: KEY,
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
  it('deletes it on Convex as the session, then ends every session it has', async () => {
    const d = deps()
    const cookie = await signedUp(d)
    const elsewhere = await answer(post(AUTH_PATHS.testSignIn, { ...ACCOUNT, flow: 'signIn' }), d)
    const res = await answer(post(AUTH_PATHS.deleteAccount, undefined, { cookie }), d)
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    const call = calls.at(-1)
    expect(JSON.parse(String(call?.body))).toMatchObject({ path: 'account:deleteAccount' })
    expect(claimsOf(call?.authorization?.replace('Bearer ', '') ?? '')).toMatchObject({
      iss: SESSION_ISSUER,
      sub: expect.stringMatching(/^user1\|/),
    })
    for (const c of [cookie, cookieOf(elsewhere)]) {
      const after = new Request(`${ORIGIN}${AUTH_PATHS.token}`, { headers: { cookie: c } })
      expect((await answer(after, d)).status).toBe(401)
    }
  })

  it("keeps the account and its sessions when Convex refuses, with Convex's reason", async () => {
    const d = deps()
    const cookie = await signedUp(d)
    ;(
      globalThis.fetch as unknown as { mockImplementation: (f: unknown) => void }
    ).mockImplementation(async () =>
      Response.json({ status: 'error', errorMessage: 'refused', errorData: 'You organise a Game.' })
    )
    const res = await answer(post(AUTH_PATHS.deleteAccount, undefined, { cookie }), d)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ errorMessage: 'refused', errorData: 'You organise a Game.' })
    const after = new Request(`${ORIGIN}${AUTH_PATHS.token}`, { headers: { cookie } })
    expect((await answer(after, d)).status).toBe(200)
  })

  it('is a 401 signed out, and refused from another origin', async () => {
    expect((await answer(post(AUTH_PATHS.deleteAccount), deps())).status).toBe(401)
    const foreign = post(AUTH_PATHS.deleteAccount, undefined, { origin: 'https://evil.example' })
    expect((await answer(foreign, deps())).status).toBe(403)
  })
})
