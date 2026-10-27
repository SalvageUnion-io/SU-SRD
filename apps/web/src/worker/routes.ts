/**
 * The site Worker's routes: each is an Astro endpoint (`astro/worker/route.ts`,
 * injected at its pattern by `astro/build/workerRoutes.ts`), which the
 * Cloudflare adapter runs for a request no file answers, and for everything
 * under `/build` and `/play` (`run_worker_first`). Astro picks the route by
 * its pattern; the route here answers it, or hands a path it has nothing at
 * to `miss`.
 *
 *   - `errors`: `POST /__errors` → a browser error report, logged for
 *     Workers Issues (`errorReports.ts`).
 *   - `auth`: `/auth/*` → sign-in, sign-out, who is signed in, and account
 *     deletion (`./auth/`).
 *   - `app`: `/build`, `/play` and below → the app (`./app.ts`); a file it
 *     does not have is a miss.
 *   - `rooms`: `/__rooms/*` → each room kind's schema version (`health`), a
 *     member's socket to a Game's room, the signed-in player's socket to
 *     their account room (`./roomRoutes.ts`), one Games call by its name
 *     (`call`, `./gameCalls.ts`), and the player's profile, export and
 *     feedback, an admin's metrics, and the build floor (`./accountRoutes.ts`).
 *   - `shared`: `/__shared/*` → public sheets, previews, Homebrew's standing
 *     and moderation, and crew patterns, from the shared database
 *     (`./sharedRoutes.ts`).
 *   - `photos`: `/__photos` → an entity photo uploaded to or served from R2
 *     (`./photos.ts`).
 *   - `homebrew`: `GET /homebrew/patterns.json` → the players' shared
 *     patterns for the SRD's pages (`./homebrew.ts`).
 *   - `miss`: anything else → the site's miss (`./miss.ts`).
 */

import {
  accountSocketPath,
  gameOfSocketPath,
  ROOMS_CALL_PATH,
  ROOMS_HEALTH_PATH,
} from '../rooms/routes'
import { isAccountPath, serveAccount } from './accountRoutes'
import { serveApp } from './app'
import { handleAuth } from './auth/index'
import { d1Sql } from './auth/store'
import type { Env } from './env'
import { handleErrorReport } from './errorReports'
import { serveGameCall } from './gameCalls'
import { serveHomebrew } from './homebrew'
import { serveMiss } from './miss'
import { isPhotosPath, servePhotos } from './photos'
import { serveAccountSocket, serveGameSocket, serveRoomsHealth } from './roomRoutes'
import type { GameRoomStub } from './rooms'
import { rooms } from './rooms'
import type { WorkerRouteName } from './routeTable'
import { deleteRoomAccount } from './shared/accountDeletion'
import type { SharedDb } from './shared/db'
import { isSharedPath, serveShared } from './sharedRoutes'

type Serve = (request: Request, env: Env) => Promise<Response>

/** Sign-in: Discord's OAuth, the session, and account deletion. */
async function auth(request: Request, env: Env): Promise<Response> {
  const res = await handleAuth(request, {
    sql: d1Sql(env.SHARED),
    discord:
      env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
        ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET }
        : undefined,
    callbackOrigin: env.AUTH_CALLBACK_ORIGIN,
    adminIds: env.ADMIN_DISCORD_IDS,
    removeAccount: (who) =>
      deleteRoomAccount(who, {
        db: env.SHARED as unknown as SharedDb,
        game: (gameId) => rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub,
        account: (discordId) => rooms().AccountRoom.getByName(discordId),
      }),
    testAuth: env.TEST_AUTH === 'true',
  })
  return res ?? serveMiss(request, env)
}

/** `/__rooms/*`: the rooms answer for themselves. */
function roomsRoute(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname === ROOMS_HEALTH_PATH && request.method === 'GET') return serveRoomsHealth()
  const gameId = gameOfSocketPath(pathname)
  if (gameId !== null) return serveGameSocket(request, gameId, env)
  if (pathname === accountSocketPath()) return serveAccountSocket(request, env)
  if (pathname === ROOMS_CALL_PATH) return serveGameCall(request, env)
  if (isAccountPath(pathname)) return serveAccount(request, env)
  return serveMiss(request, env)
}

/** Each route by its name in `WORKER_ROUTES`. */
export const SERVE: Record<WorkerRouteName, Serve> = {
  errors: (request, env) =>
    handleErrorReport(request, { app: 'web', limiter: env.ERROR_REPORT_LIMIT }),
  auth,
  app: async (request, env) => (await serveApp(request, env)) ?? serveMiss(request, env),
  rooms: roomsRoute,
  shared: (request, env) =>
    isSharedPath(new URL(request.url).pathname)
      ? serveShared(request, env)
      : serveMiss(request, env),
  photos: (request, env) =>
    isPhotosPath(new URL(request.url).pathname)
      ? servePhotos(request, env)
      : serveMiss(request, env),
  homebrew: (request, env) =>
    request.method === 'GET' ? serveHomebrew(new URL(request.url), env) : serveMiss(request, env),
  miss: serveMiss,
}
