/**
 * Sign-in, on the site Worker: Discord OAuth, accounts and sessions in
 * D1 (`./store.ts`), the session in an HttpOnly cookie, and a short-lived
 * token Convex accepts as a custom JWT provider while it is still the server
 * of record (`convex/auth.config.ts`).
 *
 *   - `GET /auth/sign-in?to=` → Discord, with PKCE; `to` is a path on this
 *     site, so an invite comes straight back to itself.
 *   - `GET /auth/callback` → the account saved, linked to its Convex account,
 *     a session opened, back to `to`.
 *   - `GET /auth/token` → `{ token, account }` for the Convex client, or 401.
 *   - `POST /auth/sign-out` → the session closed.
 *   - `POST /auth/test-sign-in` → the test seam, only where `TEST_AUTH` is
 *     exactly `'true'` (never production's `wrangler.jsonc`); a 404 elsewhere.
 *
 * Admin stays `ADMIN_DISCORD_IDS` on Convex, read through the linked account.
 */

import { Discord, generateCodeVerifier, generateState } from 'arctic'
import { getFunctionName, makeFunctionReference } from 'convex/server'
import { APP_BASE } from 'game-domain/appAddress'
import {
  DISCORD_SUBJECT,
  LINK_ISSUER,
  SESSION_ISSUER,
  TEST_SUBJECT,
  TOKEN_AUDIENCE,
} from 'game-domain/authWire'
import type { TokenAnswer } from '../../lib/auth/paths'
import { AUTH_PATHS } from '../../lib/auth/paths'
import type { SigningKey } from './crypto'
import { base64urlJson, sha256Hex, signingKey, signToken } from './crypto'
import type { AuthSql, D1Like, SignIn } from './store'
import {
  authStore,
  closeSession,
  d1Sql,
  openSession,
  readSession,
  SESSION_MS,
  saveAccount,
  testSecret,
} from './store'

export type AuthDeps = {
  sql: AuthSql
  /** The Convex deployment the app talks to. */
  convexUrl: string
  discord?: { clientId: string; clientSecret: string }
  /** `AUTH_SIGNING_KEY`. Unset, nobody can sign in. */
  signingKey?: string
  /** `TEST_AUTH === 'true'`. */
  testAuth: boolean
  now?: () => number
}

const SESSION_COOKIE = 'su_session'
const OAUTH_COOKIE = 'su_oauth'
/** The token Convex reads lives ten minutes; the client asks again before it ends. */
const TOKEN_TTL_S = 10 * 60
const OAUTH_TTL_S = 10 * 60
const LINK = getFunctionName(makeFunctionReference<'mutation'>('accountLink:link'))

/** The answer for an `/auth/*` request, or `null` for a path that is not one. */
export async function handleAuth(request: Request, deps: AuthDeps): Promise<Response | null> {
  const url = new URL(request.url)
  const get = request.method === 'GET'
  switch (url.pathname) {
    case AUTH_PATHS.signIn:
      return get ? signIn(url, deps) : null
    case AUTH_PATHS.callback:
      return get ? callback(request, url, deps) : null
    case AUTH_PATHS.token:
      return get ? token(request, url, deps) : null
    case AUTH_PATHS.signOut:
      return request.method === 'POST'
        ? guarded(request, url, () => signOut(request, url, deps))
        : null
    case AUTH_PATHS.testSignIn:
      if (!deps.testAuth || request.method !== 'POST') return null
      return guarded(request, url, () => testSignIn(request, url, deps))
    default:
      return null
  }
}

/** A POST from another origin is refused: the cookie alone must not sign anyone out or in. */
function guarded(request: Request, url: URL, run: () => Promise<Response>): Promise<Response> {
  if (request.headers.get('origin') !== url.origin)
    return Promise.resolve(new Response('Forbidden', { status: 403 }))
  return run()
}

/** A path on this site; anything else is the app's front door. */
function sitePath(raw: string | null | undefined): string {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return `${APP_BASE}/`
  return raw
}

function cookie(url: URL, name: string, value: string, maxAgeS: number, path = '/'): string {
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${name}=${value}; Path=${path}; Max-Age=${maxAgeS}; HttpOnly; SameSite=Lax${secure}`
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' })
  for (const c of cookies) headers.append('set-cookie', c)
  return new Response(null, { status: 302, headers })
}

function discordClient(url: URL, deps: AuthDeps): Discord | null {
  if (!deps.discord || !deps.signingKey) return null
  return new Discord(
    deps.discord.clientId,
    deps.discord.clientSecret,
    `${url.origin}${AUTH_PATHS.callback}`
  )
}

function signIn(url: URL, deps: AuthDeps): Response {
  const discord = discordClient(url, deps)
  if (discord === null) return new Response('Sign-in is not configured here', { status: 503 })
  const state = generateState()
  const verifier = generateCodeVerifier()
  const to = sitePath(url.searchParams.get('to'))
  const authorize = discord.createAuthorizationURL(state, verifier, ['identify', 'email'])
  return redirect(authorize.href, [
    cookie(url, OAUTH_COOKIE, base64urlJson({ state, verifier, to }), OAUTH_TTL_S, '/auth/'),
  ])
}

type OAuthCookie = { state: string; verifier: string; to: string }

function readOAuthCookie(request: Request): OAuthCookie | null {
  const raw = readCookie(request, OAUTH_COOKIE)
  if (!raw) return null
  try {
    const value = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))) as OAuthCookie
    return typeof value.state === 'string' && typeof value.verifier === 'string' ? value : null
  } catch {
    return null
  }
}

/** Discord's `/users/@me`, the fields read. */
type DiscordUser = {
  id: string
  username: string
  global_name?: string | null
  discriminator?: string
  avatar?: string | null
  email?: string | null
}

/** Discord's CDN avatar, or the default one it draws for an account without. */
export function discordAvatar(user: DiscordUser): string {
  if (user.avatar)
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}`
  const index =
    !user.discriminator || user.discriminator === '0'
      ? Number((BigInt(user.id) >> 22n) % 6n)
      : Number(user.discriminator) % 5
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}

async function callback(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const saved = readOAuthCookie(request)
  const clear = cookie(url, OAUTH_COOKIE, '', 0, '/auth/')
  const to = sitePath(saved?.to)
  const code = url.searchParams.get('code')
  const discord = discordClient(url, deps)
  // Cancelled on Discord's page, or a stale or forged round trip: back where
  // the player was, signed out.
  if (!code || saved === null || saved.state !== url.searchParams.get('state') || !discord)
    return redirect(to, [clear])
  try {
    const tokens = await discord.validateAuthorizationCode(code, saved.verifier)
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${tokens.accessToken()}` },
    })
    if (!res.ok) throw new Error(`Discord /users/@me answered ${res.status}`)
    const user = (await res.json()) as DiscordUser
    const session = await signInAs(url, deps, {
      discordId: user.id,
      testEmail: null,
      name: user.global_name || user.username,
      avatarUrl: discordAvatar(user),
      email: user.email || null,
    })
    return redirect(to, [clear, session])
  } catch (err) {
    // Workers Issues groups it; the player lands signed out where they were.
    console.error('Discord sign-in failed', err)
    return redirect(to, [clear])
  }
}

/** Links the sign-in to its Convex account, saves it, opens a session: its cookie. */
async function signInAs(
  url: URL,
  deps: AuthDeps,
  signIn: SignIn & { secret?: string }
): Promise<string> {
  const sql = await authStore(deps.sql)
  const now = (deps.now ?? Date.now)()
  const accountId = await linkToConvex(deps, signIn, now)
  await saveAccount(sql, { ...signIn, accountId }, now)
  const token = await openSession(sql, accountId, now)
  return cookie(url, SESSION_COOKIE, token, SESSION_MS / 1000)
}

async function key(deps: AuthDeps): Promise<SigningKey> {
  if (!deps.signingKey) throw new Error('AUTH_SIGNING_KEY is not set')
  return signingKey(deps.signingKey)
}

/**
 * The sign-in's Convex user id, made if it has none: `accountLink.link`,
 * called with a link token over Convex's HTTP API. A Discord account that
 * signed in through Convex Auth finds its own `users` row again.
 */
async function linkToConvex(deps: AuthDeps, account: SignIn, now: number): Promise<string> {
  const claims = {
    iss: LINK_ISSUER,
    aud: TOKEN_AUDIENCE,
    sub: account.discordId
      ? `${DISCORD_SUBJECT}${account.discordId}`
      : `${TEST_SUBJECT}${account.testEmail}`,
    ...(account.name ? { name: account.name } : {}),
    ...(account.avatarUrl ? { picture: account.avatarUrl } : {}),
    ...(account.email ? { email: account.email } : {}),
  }
  const res = await fetch(`${deps.convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await signToken(await key(deps), claims, 60, now)}`,
    },
    body: JSON.stringify({ path: LINK, args: {}, format: 'json' }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    status?: string
    value?: unknown
    errorMessage?: string
  }
  if (body.status !== 'success' || typeof body.value !== 'string')
    throw new Error(`accountLink.link failed: ${body.errorMessage ?? res.status}`)
  return body.value
}

function json(body: unknown, status: number, cookies: string[] = []): Response {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' })
  for (const c of cookies) headers.append('set-cookie', c)
  return new Response(JSON.stringify(body), { status, headers })
}

/**
 * Who a Worker route's caller is. `discordId` is never null: the rooms key
 * people by it, so a test account (no Discord) answers a stable stand-in,
 * `test:` and the SHA-256 of its email, which no Discord id can equal.
 */
export type Identity = { accountId: string; discordId: string; admin: boolean }

/**
 * @public For the rooms and the shared reads' signed-in routes.
 *
 * Who the request's session cookie signs in, or `null`. `admin` is a Discord
 * id `ADMIN_DISCORD_IDS` lists (comma-separated), as on Convex. Mints nothing.
 */
export async function identityOf(
  request: Request,
  env: { SHARED: D1Like; ADMIN_DISCORD_IDS?: string },
  now = Date.now()
): Promise<Identity | null> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return null
  const session = await readSession(await authStore(d1Sql(env.SHARED)), raw, now)
  if (session === null) return null
  const { accountId, discordId, testEmail } = session.account
  const admins = (env.ADMIN_DISCORD_IDS ?? '').split(',').map((id) => id.trim())
  if (discordId !== null) return { accountId, discordId, admin: admins.includes(discordId) }
  return {
    accountId,
    discordId: `${TEST_SUBJECT}${await sha256Hex(testEmail ?? accountId)}`,
    admin: false,
  }
}

async function token(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const raw = readCookie(request, SESSION_COOKIE)
  const signedOut = () =>
    json({ token: null }, 401, raw ? [cookie(url, SESSION_COOKIE, '', 0)] : [])
  if (!raw || !deps.signingKey) return signedOut()
  const sql = await authStore(deps.sql)
  const now = (deps.now ?? Date.now)()
  const session = await readSession(sql, raw, now)
  if (session === null) return signedOut()
  const userId = session.account.accountId
  const signed = await signToken(
    await key(deps),
    { iss: SESSION_ISSUER, aud: TOKEN_AUDIENCE, sub: `${userId}|${session.sessionId}` },
    TOKEN_TTL_S,
    now
  )
  const answer: TokenAnswer = { token: signed, account: userId }
  return json(
    answer,
    200,
    session.renewed ? [cookie(url, SESSION_COOKIE, raw, SESSION_MS / 1000)] : []
  )
}

async function signOut(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (raw) await closeSession(await authStore(deps.sql), raw)
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': cookie(url, SESSION_COOKIE, '', 0), 'cache-control': 'no-store' },
  })
}

/**
 * The test seam's server half. `signUp` makes the account (and refuses one
 * that exists, so a run never inherits another's shelf); `signIn` returns to
 * one with the same password.
 */
async function testSignIn(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
    flow?: unknown
  } | null
  const { email, password, flow } = body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string' || email === '')
    return new Response('email and password', { status: 400 })
  const secret = await sha256Hex(password)
  const existing = await testSecret(await authStore(deps.sql), email)
  if (flow === 'signIn' ? existing !== secret : existing !== undefined)
    return new Response(flow === 'signIn' ? 'Invalid credentials' : 'Account exists', {
      status: flow === 'signIn' ? 401 : 409,
    })
  const session = await signInAs(url, deps, {
    discordId: null,
    testEmail: email,
    name: null,
    avatarUrl: null,
    email,
    secret,
  })
  return new Response(null, { status: 204, headers: { 'set-cookie': session } })
}
