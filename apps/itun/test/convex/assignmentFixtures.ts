import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { testConvex } from './harness'

/**
 * Shared setup for the Convex suites: `makeUser` (every suite's identity-bound
 * user) and, for the assignment-model suites (ADR-037), a Game with a second
 * member plus pilots / mechs / crawlers written through the same mutations the
 * client store calls, so every row carries the `appId` the links address it by.
 */

export type Ctx = ReturnType<typeof testConvex>
export type User = Awaited<ReturnType<typeof makeUser>>

export async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/** A Game run by `organizer` (table runner while it has no Mediator), joined by `player`. */
export async function seedTable(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

const TS = '2026-01-01T00:00:00.000Z'

export function pilotBody(id: string, gameId: string | null) {
  return {
    id,
    schemaVersion: 1,
    name: `Pilot ${id}`,
    callsign: id,
    classRef: 'salvager',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    conditions: [],
    gameId,
    createdAt: TS,
    updatedAt: TS,
  }
}

export function mechBody(id: string, gameId: string | null) {
  return {
    id,
    schemaVersion: 1,
    name: `Mech ${id}`,
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    gameId,
    createdAt: TS,
    updatedAt: TS,
  }
}

export function crawlerBody(id: string, gameId: string | null, name = `Crawler ${id}`) {
  return {
    id,
    schemaVersion: 1,
    name,
    techLevel: '1',
    systems: [],
    gameId,
    createdAt: TS,
    updatedAt: TS,
  }
}

/** A pilot through the client's own write path (`upsertByAppId`). */
export async function addPilot(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'pilots',
    appId: id,
    gameId,
    body: pilotBody(id, gameId),
    expectedUpdatedAt: null,
  })
}

/** A mech through the client's own write path (`upsertByAppId`). */
export async function addMech(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'mechs',
    appId: id,
    gameId,
    body: mechBody(id, gameId),
    expectedUpdatedAt: null,
  })
}

/** A crawler through `createCrawler` — on the caller's shelf when `gameId` is null. */
export async function addCrawler(user: User, id: string, gameId: Id<'games'> | null) {
  return await user.as.mutation(api.entities.createCrawler, {
    gameId,
    appId: id,
    body: crawlerBody(id, gameId),
  })
}

/** Move a pilot or mech the way `MoveToContainerControl` does: re-upsert with a new `gameId`. */
export async function moveOwnable(
  user: User,
  table: 'pilots' | 'mechs',
  id: string,
  gameId: Id<'games'> | null
) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table,
    appId: id,
    gameId,
    body: table === 'pilots' ? pilotBody(id, gameId) : mechBody(id, gameId),
    expectedUpdatedAt: null,
  })
}

export const ref = {
  pilot: (id: string) => ({ type: 'pilot' as const, id }),
  mech: (id: string) => ({ type: 'mech' as const, id }),
  crawler: (id: string) => ({ type: 'crawler' as const, id }),
}

/** Draw a link as the client does. */
export async function link(
  user: User,
  from: { type: 'pilot' | 'mech' | 'crawler'; id: string },
  to: { type: 'pilot' | 'mech' | 'crawler'; id: string },
  type: 'mech-to-pilot' | 'pilot-to-crawler' | 'mech-to-crawler'
) {
  await user.as.mutation(api.entities.upsertSoftLink, { from, to, type })
}

/** Every link row, as (type, from, to, gameId) for readable assertions. */
export async function allLinks(t: Ctx) {
  const rows = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
  return rows.map((l) => ({ type: l.type, from: l.from.id, to: l.to.id, gameId: l.gameId }))
}
