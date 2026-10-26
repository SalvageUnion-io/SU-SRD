/**
 * salvageunion.io on Workers Static Assets (ADR-033): the one Worker for the
 * whole app. Every reference page is pre-rendered, so this script answers only
 * the requests no file matches, and everything under `/build` and `/play`, the
 * app's (`./app.ts`).
 *
 * ## What reaches this script, and what does not
 *
 * Static Assets answers first, with `public/_headers` applied: a real file is
 * served as itself and never runs this script. `not_found_handling` is `none`,
 * so a miss lands here instead of on the platform's `404-page` handling.
 * `run_worker_first` sends `/build`, `/play` and below here before Static
 * Assets looks.
 *
 *   - `error-intake`: `POST /__errors` → a browser error report, and `POST /__convex-logs` →
 *     Convex's log stream, both logged for Workers Issues
 *     (`errorReports.ts`).
 *   - `auth`: `/auth/*` → sign-in, sign-out and the session's token
 *     (`./auth/`).
 *   - `app`: `/build`, `/play` and below → the app (`./app.ts`); a file it
 *     does not have falls through to the rules below.
 *   - `rooms-health`: `GET /__rooms/health` → each room kind's schema
 *     version, or a 503 (`./roomRoutes.ts`).
 *   - `game-socket`: `/__rooms/games/:id/socket` → a member's socket to the
 *     Game's room (`./roomRoutes.ts`, who may: `./roomAuth.ts`).
 *   - `account-socket`: `/__rooms/account/socket` → the signed-in player's
 *     socket to their own account room (`./roomRoutes.ts`).
 *   - `game-call`: `POST /__rooms/call` → one Games call by its Convex
 *     name, as the signed-in player (`./gameCalls.ts`).
 *   - `account`: `/__rooms/account/*`, `/__rooms/admin/*` and `/__rooms/floor`
 *     → the player's profile, export and feedback, an admin's metrics, and
 *     the build floor (`./accountRoutes.ts`).
 *   - `homebrew`: `GET /homebrew/patterns.json` → the players' shared
 *     patterns for the SRD's pages (`./homebrew.ts`).
 *   - `shared`: `/__shared/*` → public sheets, previews, Homebrew's standing
 *     and moderation, and crew patterns, from the shared database
 *     (`./sharedRoutes.ts`).
 *   - `photos`: `/__photos` → an entity photo uploaded to or served from R2
 *     (`./photos.ts`).
 *   - `chunk-miss`: `/assets/*` (or `/build/assets/*`) → a bare **404**.
 *   - `api-root`: `/api/v1` or `/api/v1/` itself → a **301** to the tree's
 *     manifest, `/api/v1/index.json`: still JSON for a client, and the list of
 *     every file for a person.
 *   - `api-miss`: anything else under `/api/v1` → a JSON **404** naming the
 *     manifest, so a client reading the Dataset API never parses the HTML page
 *     (ADR-056).
 *   - `legacy-301`: a page path from before the move out of `/schema/…/item/`
 *     → a **301** to where it lives now (`../lib/redirects.ts`).
 *   - `not-found`: anything else → `404.html`, read through the asset
 *     binding, with a 404.
 *
 * The 404s say `cache-control: no-store`; the 301 is permanent and cacheable.
 *
 * ## Why the script exists at all
 *
 * `_headers` matches on the request path, never on the status, and Static
 * Assets applies it to the `404-page` response as well. So with no script, the
 * `/assets/*` rule stamped `public, max-age=31536000, immutable` on the 404 for
 * a chunk that is not there: a client that asked for a chunk before the deploy
 * bringing it finished kept the 404 for a year. `_headers` is not applied to a
 * response this script builds, so the 404s here carry only what is set below.
 * The `not-found` page comes back from the binding, which does apply `_headers`
 * (the CSP and the rest of the `/*` block) for its path, `/404`.
 */

import { API_V1_PATH } from '../lib/apiV1Paths'
import { appPath } from '../lib/appBase'
import { AUTH_PREFIX } from '../lib/auth/paths'
import { HOMEBREW_PATTERNS_PATH } from '../lib/homebrew/endpoint'
import { currentPathFor, retiredSitePage } from '../lib/redirects'
import {
  accountSocketPath,
  gameOfSocketPath,
  ROOMS_CALL_PATH,
  ROOMS_HEALTH_PATH,
} from '../rooms/routes'
import { isAccountPath, serveAccount } from './accountRoutes'
import type { AppEnv } from './app'
import { isAppPath, serveApp } from './app'
import { handleAuth } from './auth/index'
import type { D1Like } from './auth/store'
import { d1Sql } from './auth/store'
import type { CronEnv } from './crons'
import { runCron } from './crons'
import { CUTOVER_PREFIX, handleCutover } from './cutover'
import type { RateLimiter } from './errorReports'
import {
  CONVEX_LOG_STREAM_PATH,
  ERROR_REPORT_PATH,
  handleConvexLogStream,
  handleErrorReport,
} from './errorReports'
import { serveGameCall } from './gameCalls'
import { serveHomebrew } from './homebrew'
import type { PhotoBucket } from './photos'
import { isPhotosPath, servePhotos } from './photos'
import { serveAccountSocket, serveGameSocket, serveRoomsHealth } from './roomRoutes'
import { isSharedPath, serveShared } from './sharedRoutes'

export { BotGateway } from './botGateway'
export { AccountRoom, GameRoom } from './rooms'

export type Env = AppEnv &
  CronEnv & {
    /** Caps error reports per address (`wrangler.jsonc`); absent in a Preview. */
    ERROR_REPORT_LIMIT?: RateLimiter
    /**
     * The Convex log stream's webhook secret, from the Convex dashboard. Set
     * with `wrangler secret put`; unset, the stream endpoint answers 503.
     */
    CONVEX_LOG_STREAM_SECRET?: string
    /** The shared D1 database; sign-in keeps accounts and sessions there (`./auth/store.ts`). */
    SHARED: D1Like
    /** The Discord application's OAuth client, secrets both. Unset, sign-in answers 503. */
    DISCORD_CLIENT_ID?: string
    DISCORD_CLIENT_SECRET?: string
    /**
     * The origin whose `/auth/callback` Discord returns to, for a Worker
     * Preview: production's, which hands the code back (`./auth/index.ts`).
     * Unset, each origin is its own and Discord must list it.
     */
    AUTH_CALLBACK_ORIGIN?: string
    /** The private JWK the session's Convex token is signed with (`scripts/authKeys.ts`). */
    AUTH_SIGNING_KEY?: string
    /** `'true'` only in `.dev.vars` for a test build: the test sign-in seam. */
    TEST_AUTH?: string
    /** The cutover runner's bearer secret ; unset, its door is a 404. */
    CUTOVER_SECRET?: string
    /** Entity photos (R2, `./photos.ts`); unset, an upload answers 503. */
    PHOTOS?: PhotoBucket
    /** The site admins' Discord ids, comma-separated (`./auth/index.ts` `identityOf`). */
    ADMIN_DISCORD_IDS?: string
  }

/**
 * Where the Convex log stream posted before the app was one: the webhook the
 * Convex dashboard still names until it is pointed at `CONVEX_LOG_STREAM_PATH`.
 */
const RETIRED_CONVEX_LOG_STREAM_PATH = appPath(CONVEX_LOG_STREAM_PATH)

/** `/404`, not `/404.html`: the asset server's HTML handling redirects the latter. */
const NOT_FOUND_PAGE = '/404'

function notFound(body: BodyInit | null, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('cache-control', 'no-store')
  return new Response(body, { status: 404, headers: merged })
}

/** The Dataset API's tree; every file in it is a real file, so a miss is a 404. */
function isApiPath(pathname: string): boolean {
  return pathname === API_V1_PATH || pathname.startsWith(`${API_V1_PATH}/`)
}

/** A miss under the API, as JSON a client can read, on the API's CORS terms. */
function apiNotFound(url: URL): Response {
  const body = JSON.stringify({
    error: 'not_found',
    path: url.pathname,
    index: `${url.origin}${API_V1_PATH}/index.json`,
    docs: `${url.origin}/api/`,
  })
  return notFound(body, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  })
}

/** A rotated or never-built chunk: nothing a browser could render. */
function isChunk(pathname: string): boolean {
  return pathname.startsWith('/assets/') || pathname.startsWith(appPath('/assets/'))
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  /** A Cron Trigger (`./crons.ts`). */
  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env): Promise<void> {
    await runCron(controller.cron, env, controller.scheduledTime)
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // E. Errors from elsewhere: the browser's, and Convex's log stream.
    if (url.pathname === ERROR_REPORT_PATH) {
      return handleErrorReport(request, { app: 'web', limiter: env.ERROR_REPORT_LIMIT })
    }
    if (
      url.pathname === CONVEX_LOG_STREAM_PATH ||
      url.pathname === RETIRED_CONVEX_LOG_STREAM_PATH
    ) {
      return handleConvexLogStream(request, env.CONVEX_LOG_STREAM_SECRET)
    }

    // A. Sign-in.
    if (url.pathname.startsWith(AUTH_PREFIX)) {
      const res = await handleAuth(request, {
        sql: d1Sql(env.SHARED),
        convexUrl: env.CONVEX_URL ?? '',
        discord:
          env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
            ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET }
            : undefined,
        callbackOrigin: env.AUTH_CALLBACK_ORIGIN,
        signingKey: env.AUTH_SIGNING_KEY,
        testAuth: env.TEST_AUTH === 'true',
      })
      if (res !== null) return res
    }

    // B. The app, under its base and Play's root.
    if (isAppPath(url.pathname)) {
      const res = await serveApp(request, env)
      if (res !== null) return res
    }

    // C. The cutover's door, for `tools/cutover-run.ts` alone.
    if (url.pathname.startsWith(CUTOVER_PREFIX)) return handleCutover(request, env)

    // R. The rooms answer for themselves.
    if (url.pathname === ROOMS_HEALTH_PATH && request.method === 'GET') {
      return serveRoomsHealth()
    }
    const gameId = gameOfSocketPath(url.pathname)
    if (gameId !== null) return serveGameSocket(request, gameId, env)
    if (url.pathname === accountSocketPath()) return serveAccountSocket(request, env)
    if (url.pathname === ROOMS_CALL_PATH) return serveGameCall(request, env)
    if (isAccountPath(url.pathname)) return serveAccount(request, env)

    // S. What crosses rooms, and the photos.
    if (isSharedPath(url.pathname)) return serveShared(request, env)
    if (isPhotosPath(url.pathname)) return servePhotos(request, env)

    // H. Homebrew for the SRD's pages, from Convex until the shared database is filled.
    if (url.pathname === HOMEBREW_PATTERNS_PATH && request.method === 'GET') {
      return serveHomebrew(url, env)
    }

    // 1. The Dataset API's root, a directory with no file: its manifest.
    // Anything else under it with no file is a JSON miss.
    if (url.pathname.replace(/\/+$/, '') === API_V1_PATH) {
      return Response.redirect(new URL(`${API_V1_PATH}/index.json${url.search}`, url).href, 301)
    }
    if (isApiPath(url.pathname)) return apiNotFound(url)

    // 2. A rotated or never-built chunk.
    if (isChunk(url.pathname)) {
      return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    }

    // 3. A page under the old grammar, or one that is gone (the search page):
    // one hop to its new address, query kept.
    const moved = currentPathFor(url.pathname) ?? retiredSitePage(url.pathname)
    if (moved) {
      return new Response(null, {
        status: 301,
        headers: {
          location: `${moved}${url.search}`,
          'cache-control': 'public, max-age=86400',
        },
      })
    }

    // 4. Every other miss: the site's own 404 page.
    const page = await env.ASSETS.fetch(
      new Request(new URL(NOT_FOUND_PAGE, url), { method: 'GET' })
    )
    if (!page.ok) return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    return notFound(page.body, page.headers)
  },
}
