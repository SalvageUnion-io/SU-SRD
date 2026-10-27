/**
 * Sign-in, on the site Worker: Discord OAuth, accounts and sessions in
 * D1 (`./store.ts`), the session in an HttpOnly cookie.
 *
 *   - `GET /auth/sign-in?to=` → Discord, with PKCE; `to` is a path on this
 *     site, so an invite comes straight back to itself.
 *   - `GET /auth/callback` → the account saved, a session opened, back to `to`.
 *   - `GET /auth/session` → who is signed in (`SessionAnswer`), or 401.
 *   - `POST /auth/sign-out` → the session closed.
 *   - `POST /auth/test-sign-in` → the test seam, only where `TEST_AUTH` is
 *     exactly `'true'` (never production's `wrangler.jsonc`); a 404 elsewhere.
 *
 * An admin is a Discord id `ADMIN_DISCORD_IDS` lists.
 *
 * A Worker Preview has its own origin, which Discord would have to list. With
 * `AUTH_CALLBACK_ORIGIN` set, its round trip comes back through that origin's
 * `/auth/callback` instead, which hands the code on to the Preview named in
 * the state (`PREVIEW_HOST` only). The Preview trades it there: PKCE ties the
 * code to the verifier in its own cookie, so the hand-off carries nothing
 * another host could use.
 */

import { Discord, generateCodeVerifier, generateState, OAuth2RequestError } from 'arctic'
import { APP_BASE } from 'game-domain/appAddress'
import type { SessionAnswer } from '../../lib/auth/paths'
import { AUTH_PATHS } from '../../lib/auth/paths'
import type { SharedDb } from '../shared/db'
import { base64urlJson, passwordHash, sha256Hex } from './crypto'
import type { Account, AuthSql, SignIn } from './store'
import {
  accountIdOf,
  authStore,
  closeSession,
  d1Sql,
  forgetAccount,
  openSession,
  readSession,
  SESSION_MS,
  saveAccount,
  testSecret,
} from './store'

export type AuthDeps = {
  sql: AuthSql
  /** Unset, nobody can sign in with Discord. */
  discord?: { clientId: string; clientSecret: string }
  /** `AUTH_CALLBACK_ORIGIN`: whose `/auth/callback` Discord returns to. Unset, this origin's. */
  callbackOrigin?: string
  /**
   * Deletes everything the account holds in the rooms and the shared database:
   * `null` once it is gone, or the refusal to answer (`deleteRoomAccount`).
   */
  removeAccount(who: Identity): Promise<Response | null>
  /** `ADMIN_DISCORD_IDS`, as `identityOf` reads it. */
  adminIds?: string
  /** `TEST_AUTH === 'true'`. */
  testAuth: boolean
  now?: () => number
}

const SESSION_COOKIE = 'su_session'
const OAUTH_COOKIE = 'su_oauth'
const OAUTH_TTL_S = 10 * 60
/** A Worker Preview of su-srd: the only hosts a callback hands a code on to. */
const PREVIEW_HOST = /^[a-z0-9-]+-su-srd\.alxjrvs\.workers\.dev$/
/** Between the Preview's host and the random state, in a handed-on round trip. */
const STATE_HOST = '~'
/** How a test account (no Discord) is named to the rooms: `test:` and the SHA-256 of its email. */
const TEST_SUBJECT = 'test:'

/** The answer for an `/auth/*` request, or `null` for a path that is not one. */
export async function handleAuth(request: Request, deps: AuthDeps): Promise<Response | null> {
  const url = new URL(request.url)
  const get = request.method === 'GET'
  switch (url.pathname) {
    case AUTH_PATHS.signIn:
      return get ? signIn(url, deps) : null
    case AUTH_PATHS.callback:
      return get ? callback(request, url, deps) : null
    case AUTH_PATHS.session:
      return get ? session(request, url, deps) : null
    case AUTH_PATHS.signOut:
      return request.method === 'POST'
        ? guarded(request, url, () => signOut(request, url, deps))
        : null
    case AUTH_PATHS.deleteAccount:
      return request.method === 'POST'
        ? guarded(request, url, () => deleteAccount(request, url, deps))
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
  if (!raw?.startsWith('/')) return `${APP_BASE}/`
  // Parsed as a browser would, which drops tabs and newlines and reads `\` as
  // `/`: whatever names another host is refused, and only the path is kept.
  const here = 'https://site.invalid'
  const parsed = new URL(raw, here)
  if (parsed.origin !== here) return `${APP_BASE}/`
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
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

function callbackOrigin(url: URL, deps: AuthDeps): string {
  return deps.callbackOrigin?.replace(/\/$/, '') || url.origin
}

function discordClient(url: URL, deps: AuthDeps): Discord | null {
  if (!deps.discord) return null
  return new Discord(
    deps.discord.clientId,
    deps.discord.clientSecret,
    `${callbackOrigin(url, deps)}${AUTH_PATHS.callback}`
  )
}

/**
 * The Preview a round trip started on, when it came back here instead: the
 * callback answers it there, with Discord's query unchanged. `null` for a
 * state this host keeps.
 */
function handOn(url: URL): Response | null {
  const state = url.searchParams.get('state') ?? ''
  const at = state.lastIndexOf(STATE_HOST)
  if (at < 0) return null
  const host = state.slice(0, at)
  if (host === url.host || !PREVIEW_HOST.test(host)) return null
  return redirect(`https://${host}${AUTH_PATHS.callback}${url.search}`)
}

function signIn(url: URL, deps: AuthDeps): Response {
  const discord = discordClient(url, deps)
  if (discord === null) return new Response('Sign-in is not configured here', { status: 503 })
  const own = callbackOrigin(url, deps) === url.origin
  const state = own ? generateState() : `${url.host}${STATE_HOST}${generateState()}`
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
  const handed = handOn(url)
  if (handed !== null) return handed
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
    // Discord's refusal is named (`invalid_client` is a wrong secret), not
    // just its stack.
    const reason =
      err instanceof OAuth2RequestError ? `: ${err.code} ${err.description ?? ''}`.trimEnd() : ''
    console.error(`Discord sign-in failed${reason}`, err)
    return redirect(to, [clear])
  }
}

/** Saves the account (made on its first sign-in), opens a session: its cookie. */
async function signInAs(
  url: URL,
  deps: AuthDeps,
  signIn: SignIn & { secret?: string }
): Promise<string> {
  const sql = await authStore(deps.sql)
  const now = (deps.now ?? Date.now)()
  const accountId = (await accountIdOf(sql, signIn)) ?? crypto.randomUUID()
  await saveAccount(sql, { ...signIn, accountId }, now)
  const token = await openSession(sql, accountId, now)
  return cookie(url, SESSION_COOKIE, token, SESSION_MS / 1000)
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
 * id `ADMIN_DISCORD_IDS` lists (comma-separated). Mints nothing.
 */
export async function identityOf(
  request: Request,
  env: { SHARED: SharedDb; ADMIN_DISCORD_IDS?: string },
  now = Date.now()
): Promise<Identity | null> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return null
  const session = await readSession(await authStore(d1Sql(env.SHARED)), raw, now)
  if (session === null) return null
  return identityFor(session.account, env.ADMIN_DISCORD_IDS)
}

async function identityFor(account: Account, adminIds: string | undefined): Promise<Identity> {
  const admins = (adminIds ?? '').split(',').map((id) => id.trim())
  const admin = account.discordId !== null && admins.includes(account.discordId)
  return { accountId: account.accountId, discordId: await personOf(account), admin }
}

/** The rooms' name for an account: its Discord id, or a test account's stand-in (`Identity`). */
async function personOf(account: Account): Promise<string> {
  if (account.discordId !== null) return account.discordId
  return `${TEST_SUBJECT}${await sha256Hex(account.testEmail ?? account.accountId)}`
}

/**
 * Deletes the account: everything it holds (`removeAccount`), then, only once
 * that is done, its sign-in and all its sessions here, so no cookie on any
 * device outlives it. A refusal answers as `removeAccount` words it.
 */
async function deleteAccount(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return json({ errorMessage: 'Not signed in' }, 401)
  const sql = await authStore(deps.sql)
  const session = await readSession(sql, raw, (deps.now ?? Date.now)())
  if (session === null) return json({ errorMessage: 'Not signed in' }, 401)
  const refused = await deps.removeAccount(await identityFor(session.account, deps.adminIds))
  if (refused !== null) return refused
  await forgetAccount(sql, session.account.accountId)
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': cookie(url, SESSION_COOKIE, '', 0), 'cache-control': 'no-store' },
  })
}

async function session(request: Request, url: URL, deps: AuthDeps): Promise<Response> {
  const raw = readCookie(request, SESSION_COOKIE)
  const signedOut = () => json(null, 401, raw ? [cookie(url, SESSION_COOKIE, '', 0)] : [])
  if (!raw) return signedOut()
  const sql = await authStore(deps.sql)
  const session = await readSession(sql, raw, (deps.now ?? Date.now)())
  if (session === null) return signedOut()
  const answer: SessionAnswer = {
    account: session.account.accountId,
    person: await personOf(session.account),
  }
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
  const secret = await passwordHash(password, email)
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
