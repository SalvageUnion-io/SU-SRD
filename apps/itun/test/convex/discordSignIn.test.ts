/**
 * Discord sign-in, end to end through the deployed HTTP routes.
 *
 * From 2026-10-06 every production sign-in failed. Discord began appending the
 * RFC 9207 `iss` parameter to its authorization response, the provider declared
 * no issuer, and `oauth4webapi` rejected each callback with `unexpected "iss"
 * (issuer) response parameter value`. `@convex-dev/auth` catches that, logs it
 * and redirects home without a code, so the user saw "refused access" and
 * Sentry saw nothing.
 *
 * Pinning the issuer string (`authProviders.test.ts`) does not prove it reaches
 * the check, so this drives the real flow: the `signIn` action, the
 * `/api/auth/signin/discord` redirect, and the `/api/auth/callback/discord`
 * callback, over the real `convex/auth.ts` and `convex/http.ts`. Only Discord's
 * token and user endpoints are faked.
 */

import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { NATIVE_FETCH_GLOBALS } from '../env'
import { testConvexWithHttp } from './harness'

const SITE_URL = 'https://itun.test'
const CONVEX_SITE_URL = 'https://deployment.convex.site'
const DISCORD_ISSUER = 'https://discord.com'
const DISCORD_USER_ID = '80351110224678912'

// Read at request time, so setting them here does not leak through a cached
// module; they are restored after the file.
const ENV = { SITE_URL, CONVEX_SITE_URL }
const savedEnv: Record<string, string | undefined> = {}

// The happy-dom preload swaps in a browser's `URL`, `Headers`, `Request` and
// `Response`, which drop `Set-Cookie` and `Cookie` — the headers the OAuth flow
// carries its PKCE verifier in. Convex runs on the runtime's own classes, so
// this file does too.
const happyDom: Partial<typeof NATIVE_FETCH_GLOBALS> = {}

beforeAll(() => {
  for (const key of Object.keys(NATIVE_FETCH_GLOBALS) as (keyof typeof NATIVE_FETCH_GLOBALS)[]) {
    Object.assign(happyDom, { [key]: globalThis[key] })
  }
  Object.assign(globalThis, NATIVE_FETCH_GLOBALS)
  for (const [key, value] of Object.entries(ENV)) {
    savedEnv[key] = process.env[key]
    process.env[key] = value
  }
})

afterAll(() => {
  Object.assign(globalThis, happyDom)
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined

afterEach(() => {
  fetchSpy?.mockRestore()
  fetchSpy = undefined
})

/** Discord's token and user endpoints — the only network the flow touches. */
function fakeDiscord() {
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
    input: Parameters<typeof fetch>[0]
  ) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url === 'https://discord.com/api/oauth2/token') {
      return Response.json({
        access_token: 'access-token',
        token_type: 'bearer',
        expires_in: 604800,
        refresh_token: 'refresh-token',
        scope: 'identify email',
      })
    }
    if (url === 'https://discord.com/api/users/@me') {
      return Response.json({
        id: DISCORD_USER_ID,
        username: 'salvager',
        global_name: 'Salvager',
        discriminator: '0',
        avatar: null,
        // Discord sends `null` for an account with no verified address.
        email: null,
      })
    }
    throw new Error(`unexpected fetch in test: ${url}`)
  }) as typeof fetch)
}

/** The `name=value` pairs of every `Set-Cookie`, as a `Cookie` request header. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/**
 * Starts a sign-in and returns Discord's callback for it: the `signIn` action,
 * then the signin route, whose cookies and `state` the callback must carry.
 */
async function startSignIn(t: ReturnType<typeof testConvexWithHttp>) {
  const started = await t.action(api.auth.signIn, { provider: 'discord', params: {} })
  if (!started.redirect) throw new Error('signIn did not return a redirect')
  const signinUrl = new URL(started.redirect)
  expect(signinUrl.origin).toBe(CONVEX_SITE_URL)

  const signin = await t.fetch(`${signinUrl.pathname}${signinUrl.search}`)
  expect(signin.status).toBe(302)
  const authorize = new URL(signin.headers.get('Location') ?? '')
  expect(`${authorize.origin}${authorize.pathname}`).toBe(
    'https://discord.com/api/oauth2/authorize'
  )

  return {
    callback(params: Record<string, string>) {
      const query = new URLSearchParams({ code: 'discord-auth-code', ...params })
      const state = authorize.searchParams.get('state')
      if (state) query.set('state', state)
      return t.fetch(`/api/auth/callback/discord?${query}`, {
        headers: { Cookie: cookieHeader(signin) },
      })
    },
  }
}

/** The `code` the callback hands back to ITUN, or null when it refused. */
function verificationCode(callback: Response): string | null {
  expect(callback.status).toBe(302)
  const location = new URL(callback.headers.get('Location') ?? '')
  expect(location.origin).toBe(SITE_URL)
  return location.searchParams.get('code')
}

describe('Discord sign-in through the deployed HTTP routes', () => {
  test("a callback carrying Discord's `iss` signs the user in", async () => {
    fakeDiscord()
    const t = testConvexWithHttp()
    const { callback } = await startSignIn(t)

    const response = await callback({ iss: DISCORD_ISSUER })

    expect(verificationCode(response)).not.toBeNull()
    const accounts = await t.run((ctx) => ctx.db.query('authAccounts').collect())
    expect(accounts).toHaveLength(1)
    const [account] = accounts
    if (!account) throw new Error('no authAccounts row')
    expect(account).toMatchObject({ provider: 'discord', providerAccountId: DISCORD_USER_ID })
    const user = await t.run((ctx) => ctx.db.get(account.userId))
    expect(user?.name).toBe('Salvager')
  })

  test('a callback without `iss` still signs the user in', async () => {
    // RFC 9207 makes the parameter optional; declaring an issuer must not
    // start requiring it.
    fakeDiscord()
    const t = testConvexWithHttp()
    const { callback } = await startSignIn(t)

    expect(verificationCode(await callback({}))).not.toBeNull()
  })

  test('a callback with a foreign `iss` is refused', async () => {
    // The control: proves the issuer check is live, so the passing case above
    // is not passing because nothing compares `iss` at all.
    fakeDiscord()
    const t = testConvexWithHttp()
    const { callback } = await startSignIn(t)

    const response = await callback({ iss: 'https://attacker.example' })

    expect(verificationCode(response)).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('authAccounts').collect())).toHaveLength(0)
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(0)
  })
})
