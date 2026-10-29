/**
 * The account's routes on the Worker (`ACCOUNT_PATHS`): the player, their
 * profile, export and feedback, and the admin metrics and build floor. Who is asking is
 * the session cookie's (`identityOf`); the player's own things are their
 * account room's, and what crosses accounts is the shared database's.
 *
 *  - A refusal the player reads answers 400 `{ refusal }`, which the client
 *    throws as a `RoomDeclined`; a body it cannot read a bare 400, signed out
 *    401, not an admin 403.
 *  - A write from another origin is refused, as sign-out's is: the cookie
 *    alone must not write.
 */

import { FEEDBACK_REFUSAL, pagePath } from 'game-domain/feedback'
import { z } from 'salvageunion-reference/zod'
import { BUILD_FLOOR } from '../lib/connection/buildFloorStamp'
import type { Profile, ShelfExport } from '../rooms/account/shelf'
import { ACCOUNT_PATHS } from '../rooms/routes'
import type { Identity } from './auth/index'
import { identityOf } from './auth/index'
import { gameRoom, rooms } from './roomStubs'
import { exportedRows, shownProfile, signInProfile } from './shared/accounts'
import type { SharedDb } from './shared/db'
import { acceptFeedback } from './shared/feedback'
import { gamesOf } from './shared/games'
import { readMetrics, takeSnapshot } from './shared/signals'

export type AccountEnv = { SHARED: SharedDb; ADMIN_DISCORD_IDS?: string }

type Identify = (request: Request, env: AccountEnv) => Promise<Identity | null>

/** What the account room answers these routes, as its stub is called. */
type AccountRoomStub = {
  profile(actor: string): Promise<Profile | null>
  setProfile(
    actor: string,
    patch: { displayName?: string | null; avatarUrl?: string | null }
  ): Promise<void>
  exportFor(actor: string): Promise<ShelfExport | null>
}

function accountRoom(discordId: string): AccountRoomStub {
  return rooms().AccountRoom.getByName(discordId) as unknown as AccountRoomStub
}

/** What `me` answers: sign-in's account id as `_id`. */
export type Me = {
  _id: string
  discordId: string
  displayName: string | null
  avatarUrl: string | null
  email: string | null
  admin: boolean
}

/** What `export` answers: `account.exportMine`'s shape, with the Games from the shared database. */
export type AccountExport = ShelfExport & {
  exportedAt: string
  homebrewReports: { reason: string; at: number }[]
  games: { gameId: string; mediator: boolean; organizer: boolean }[]
}

const ProfileSchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
})

const FeedbackSchema = z.object({
  kind: z.enum(['suggestion', 'report']),
  text: z.string(),
  page: z.string().optional(),
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

const refused = (refusal: string) => json({ refusal }, 400)
const signedOut = () => new Response(null, { status: 401 })

function shared(env: AccountEnv): SharedDb {
  return env.SHARED as unknown as SharedDb
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined))
  return parsed.success ? parsed.data : null
}

/** Whether `pathname` is one of these routes. */
export function isAccountPath(pathname: string): boolean {
  return (Object.values(ACCOUNT_PATHS) as string[]).includes(pathname)
}

/** The answer for one of `ACCOUNT_PATHS`; a method it does not take is a 405. */
export async function serveAccount(
  request: Request,
  env: AccountEnv,
  identify: Identify = identityOf
): Promise<Response> {
  const { pathname, origin } = new URL(request.url)
  const method = request.method
  if (pathname === ACCOUNT_PATHS.floor) {
    return method === 'GET' ? json(BUILD_FLOOR) : new Response(null, { status: 405 })
  }
  const write = method === 'POST'
  if (!write && method !== 'GET') return new Response(null, { status: 405 })
  if (write && request.headers.get('origin') !== origin) {
    return new Response('Forbidden', { status: 403 })
  }
  const who = await identify(request, env)
  switch (`${method} ${pathname}`) {
    case `GET ${ACCOUNT_PATHS.me}`:
      return json(who === null ? null : await me(env, who))
    case `POST ${ACCOUNT_PATHS.profile}`: {
      if (who === null) return signedOut()
      const patch = await body(request, ProfileSchema)
      if (patch === null) return new Response(null, { status: 400 })
      await accountRoom(who.discordId).setProfile(who.discordId, patch)
      await showOnRosters(env, who)
      return json(null)
    }
    case `GET ${ACCOUNT_PATHS.export}`:
      return who === null ? signedOut() : json(await exportOf(env, who))
    case `POST ${ACCOUNT_PATHS.feedback}`: {
      if (who === null) return signedOut()
      const note = await body(request, FeedbackSchema)
      if (note === null) return refused(FEEDBACK_REFUSAL.short)
      // The Discord id, as the bot's notes are: deleting the account finds both.
      const refusal = await acceptFeedback(shared(env), {
        sender: `discord:${who.discordId}`,
        source: 'app',
        kind: note.kind,
        text: note.text,
        page: pagePath(note.page),
      })
      return refusal === null ? json(null) : refused(FEEDBACK_REFUSAL[refusal])
    }
    case `GET ${ACCOUNT_PATHS.metrics}`:
      return json(who?.admin ? await readMetrics(shared(env)) : null)
    case `POST ${ACCOUNT_PATHS.refreshMetrics}`:
      if (who === null) return signedOut()
      if (!who.admin) return new Response(null, { status: 403 })
      await takeSnapshot(shared(env))
      return json(null)
    default:
      return new Response(null, { status: 405 })
  }
}

/** Their own name and avatar where they set one, else the Discord ones sign-in keeps. */
async function me(env: AccountEnv, who: Identity): Promise<Me> {
  const [account, own] = await Promise.all([
    signInProfile(shared(env), who.accountId),
    accountRoom(who.discordId).profile(who.discordId),
  ])
  return {
    _id: who.accountId,
    discordId: who.discordId,
    ...shownProfile(own, account),
    email: account?.email ?? null,
    admin: who.admin,
  }
}

/** The player's name and avatar as they now show, on the roster of every Game they are in. */
async function showOnRosters(env: AccountEnv, who: Identity): Promise<void> {
  const [account, own, games] = await Promise.all([
    signInProfile(shared(env), who.accountId),
    accountRoom(who.discordId).profile(who.discordId),
    gamesOf(shared(env), who.discordId),
  ])
  const profile = shownProfile(own, account)
  await Promise.all(
    games.map(({ gameId }) => gameRoom(gameId).act(who.discordId, 'updateProfile', { profile }))
  )
}

async function exportOf(env: AccountEnv, who: Identity): Promise<AccountExport> {
  const [shelf, rows] = await Promise.all([
    accountRoom(who.discordId).exportFor(who.discordId),
    exportedRows(shared(env), who.discordId),
  ])
  return {
    exportedAt: new Date().toISOString(),
    ...(shelf ?? { pilots: [], mechs: [], npcs: [], mechPatterns: [], encounters: [] }),
    ...rows,
  }
}
