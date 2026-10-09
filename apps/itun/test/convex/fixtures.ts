import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { crawlerFixture, mechFixture, pilotFixture } from '../../src/components/__tests__/fixtures'
import type { testConvex } from './harness'

/**
 * Setup for the Convex suites: identity-bound users, a seeded Game, sheet
 * bodies, and pilots / mechs / crawlers / links written through the same
 * mutations the client store calls, so every row carries the `appId` the links
 * address it by (ADR-037).
 *
 * The bodies are ITUN's entity fixtures (`src/components/__tests__/fixtures.ts`,
 * stamped with its `FIXTURE_NOW`) with the ids and names these suites assert
 * on, so a suite never keeps its own copy of a sheet that drifts from the
 * schema while the shared one is held to it.
 */

export type Ctx = ReturnType<typeof testConvex>
export type User = Awaited<ReturnType<typeof makeUser>>

/**
 * A user and a client signed in as them. `discordId` also seeds the
 * `authAccounts` row `@convex-dev/auth` writes on a real Discord sign-in, which
 * is what the bot resolves a Discord user against.
 */
export async function makeUser(t: Ctx, name: string, discordId?: string) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('users', { name, displayName: name })
    if (discordId !== undefined) {
      await ctx.db.insert('authAccounts', {
        userId: id,
        provider: 'discord',
        providerAccountId: discordId,
      })
    }
    return id
  })
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

/** Any field, including ones a stored body carries that the schema type omits (`gameId`). */
type Over = Record<string, unknown>

/** A pilot sheet, `p1` "Roach-Boy" the Salvager unless `over` says otherwise. */
export function pilotBody(over: Over = {}) {
  const base = { id: 'p1', name: 'Roach-Boy', callsign: 'Roach-Boy', classRef: 'salvager' }
  return { ...pilotFixture(base), ...over }
}

/** A mech sheet, `m1` on an Iron Mongrel unless `over` says otherwise. */
export function mechBody(over: Over = {}) {
  return { ...mechFixture({ id: 'm1', name: 'Mech m1', chassisRef: 'iron-mongrel' }), ...over }
}

/** A crawler sheet, `c1` "#430" at tech level 1 unless `over` says otherwise. */
export function crawlerBody(over: Over = {}) {
  return { ...crawlerFixture({ id: 'c1', name: '#430', techLevel: '1' }), ...over }
}

/** A pilot through the client's own write path (`upsertByAppId`). */
export async function addPilot(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'pilots',
    appId: id,
    gameId,
    body: pilotBody({ id, gameId, name: `Pilot ${id}`, callsign: id }),
    expectedUpdatedAt: null,
  })
}

/** A mech through the client's own write path (`upsertByAppId`). */
export async function addMech(user: User, id: string, gameId: Id<'games'> | null) {
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'mechs',
    appId: id,
    gameId,
    body: mechBody({ id, gameId, name: `Mech ${id}` }),
    expectedUpdatedAt: null,
  })
}

/** A crawler through `createCrawler` — on the caller's shelf when `gameId` is null. */
export async function addCrawler(user: User, id: string, gameId: Id<'games'> | null) {
  return await user.as.mutation(api.entities.createCrawler, {
    gameId,
    appId: id,
    body: crawlerBody({ id, gameId, name: `Crawler ${id}` }),
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
    body:
      table === 'pilots'
        ? pilotBody({ id, gameId, name: `Pilot ${id}`, callsign: id })
        : mechBody({ id, gameId, name: `Mech ${id}` }),
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
