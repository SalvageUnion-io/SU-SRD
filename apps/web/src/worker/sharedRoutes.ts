/**
 * What crosses rooms, answered from the shared database (`./shared/`) for
 * the app's screens: Convex's `publicSheet`, `homebrew` and
 * `shelf.crewPatterns` reads, and Homebrew's reports and takedowns. The rooms
 * write the rows; this decides only who may read or act (`../lib/sharing/paths.ts`).
 *
 *   - `GET  sheets/:kind/:segment`, `previews/:kind/:segment`, `invites/:code`:
 *     anyone, signed in or not: they serve only what was shared by link.
 *   - `GET  homebrew/:appId`: one pattern's place in Homebrew, for the reader.
 *   - `POST homebrew/:appId/report`: a signed-in reader, never on their own.
 *   - `POST homebrew/:appId/hidden`, `/dismiss`, `GET moderation`: a site admin.
 *   - `GET  crew-patterns`: the signed-in reader's crewmates' shared patterns;
 *     `games/:gameId/patterns`, one Game's (the Mediator's picker).
 *
 * Every answer is `{ value }`, or `{ refusal }` with a 4xx.
 */

import { isPreviewKind } from '../lib/linkPreview/previewSummary'
import { SHARED_PATH } from '../lib/sharing/paths'
import type { Identity } from './auth/index'
import { identityOf } from './auth/index'
import type { D1Like } from './auth/store'
import { reportError } from './errorReports'
import { crewPatternsFor, gamePatternsFor } from './shared/crewPatterns'
import type { SharedDb } from './shared/db'
import { invitePreview } from './shared/games'
import {
  dismissHomebrewReports,
  homebrewModeration,
  homebrewStanding,
  REPORT_REFUSALS,
  reportHomebrew,
  setHomebrewHidden,
} from './shared/homebrew'
import { publicPage, publicPreview } from './shared/publicSheets'
import { REFUSALS } from './shared/refusals'

export type SharedRoutesEnv = { SHARED: SharedDb & D1Like; ADMIN_DISCORD_IDS?: string }

type Identify = (request: Request, env: SharedRoutesEnv) => Promise<Identity | null>

function answer(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8', 'cache-control': cache },
  })
}

const value = (v: unknown) => answer(200, { value: v })
const refused = (status: number, refusal: string) => answer(status, { refusal })
const SIGN_IN = () => refused(401, REFUSALS.signIn)
const ADMINS_ONLY = () => refused(403, REFUSALS.adminsOnly)

/** Whether a path is one of these routes. */
export function isSharedPath(pathname: string): boolean {
  return pathname.startsWith(`${SHARED_PATH}/`)
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

export async function serveShared(
  request: Request,
  env: SharedRoutesEnv,
  identify: Identify = identityOf
): Promise<Response> {
  const parts = new URL(request.url).pathname
    .slice(SHARED_PATH.length + 1)
    .split('/')
    .map(decodeURIComponent)
  const get = request.method === 'GET'
  const post = request.method === 'POST'
  const db = env.SHARED
  try {
    const [route, a, b] = parts
    if (get && (route === 'sheets' || route === 'previews') && parts.length === 3) {
      if (a === undefined || b === undefined || !isPreviewKind(a)) return value(null)
      return value(route === 'sheets' ? await publicPage(db, a, b) : await publicPreview(db, a, b))
    }
    if (get && route === 'invites' && a !== undefined && parts.length === 2) {
      return value(await invitePreview(db, a))
    }
    if (route === 'homebrew' && a !== undefined) {
      const who = await identify(request, env)
      if (get && parts.length === 2) return value(await standing(db, a, who))
      if (!post || parts.length !== 3) return refused(404, REFUSALS.notFound)
      if (who === null) return SIGN_IN()
      if (b === 'report') {
        const { reason } = await readJson(request)
        const refusal = await reportHomebrew(db, {
          appId: a,
          reporterId: who.discordId,
          reason: typeof reason === 'string' ? reason : '',
        })
        return refusal === null ? value(null) : refused(400, REPORT_REFUSALS[refusal])
      }
      if (!who.admin) return ADMINS_ONLY()
      if (b === 'hidden') {
        const hidden = (await readJson(request)).hidden === true
        await setHomebrewHidden(db, a, hidden)
        return value({ hidden })
      }
      if (b === 'dismiss') {
        await dismissHomebrewReports(db, a)
        return value(null)
      }
    }
    if (get && route === 'moderation' && parts.length === 1) {
      const who = await identify(request, env)
      return value(who?.admin === true ? await homebrewModeration(db) : null)
    }
    if (get && route === 'crew-patterns' && parts.length === 1) {
      const who = await identify(request, env)
      return value(who === null ? [] : await crewPatternsFor(db, who.discordId))
    }
    if (get && route === 'games' && a !== undefined && b === 'patterns' && parts.length === 3) {
      const who = await identify(request, env)
      return value(who === null ? [] : await gamePatternsFor(db, a, who.discordId))
    }
    return refused(404, REFUSALS.notFound)
  } catch (error) {
    reportError(error, { where: 'shared.serve' })
    return refused(503, REFUSALS.unreadable)
  }
}

/** Convex's `homebrew.status`: a takedown is told to its maker and admins only. */
async function standing(db: SharedDb, appId: string, who: Identity | null) {
  const admin = who?.admin === true
  const row = await homebrewStanding(db, appId, who?.discordId ?? null)
  if (row.ownerId === null) {
    return { listed: false, hidden: false, reported: false, mine: false, admin }
  }
  const mine = who !== null && row.ownerId === who.discordId
  return {
    listed: row.listed,
    hidden: row.hidden && (admin || mine),
    reported: row.reported,
    mine,
    admin,
  }
}
