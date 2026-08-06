import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

/**
 * Soft links against the server of record.
 *
 * Links were the one part of a roster that never left the browser.
 * `mirrorEntityWrite` returned early for them as "derived" — which is nearly
 * true of a shelf and not true at all of a Game, because `listForGame` reads
 * them back. So the crew saw whatever wiring existed when the account was
 * claimed and never saw a single change afterwards: you assigned a pilot to the
 * crawler, your own sheet updated, and nobody else's did.
 *
 * That is the second half of "you couldn't assign them to a crawler" — the
 * first being that the crawler had no control to assign *with*.
 *
 * The properties pinned here are the ones that make a link safe to mirror:
 * it is identified by its endpoints (so replaying a write is a no-op rather
 * than a duplicate wire), it belongs to the container its `from` end belongs
 * to, and only somebody who may write that end may draw or cut it.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

function pilotBody(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    schemaVersion: 1,
    name: 'Babe',
    callsign: 'Babe',
    classRef: 'salvager',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    conditions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

/** A pilot row owned by `userId`, addressable by `appId`. */
async function seedPilot(t: Ctx, userId: Id<'users'>, appId: string, gameId: Id<'games'> | null) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert('pilots', {
        gameId,
        ownerId: userId,
        appId,
        body: pilotBody({ id: appId }),
        updatedAt: Date.now(),
      })
  )
}

const LINK = {
  from: { type: 'pilot' as const, id: 'pilot-app-1' },
  to: { type: 'crawler' as const, id: 'crawler-app-1' },
  type: 'pilot-to-crawler' as const,
}

describe('upsertSoftLink', () => {
  test('writes the link and inherits the container of its from end', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    await seedPilot(t, u.userId, 'pilot-app-1', gameId)

    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(1)
    expect(links[0]?.gameId).toBe(gameId)
    expect(links[0]?.type).toBe('pilot-to-crawler')
  })

  test('is idempotent — the same wire drawn twice is one wire', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await seedPilot(t, u.userId, 'pilot-app-1', null)

    await u.as.mutation(api.entities.upsertSoftLink, LINK)
    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(1)
  })

  test('re-homes an existing link when its from end moves into a game', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const pilotId = await seedPilot(t, u.userId, 'pilot-app-1', null)

    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    await t.run(async (ctx) => await ctx.db.patch(pilotId, { gameId }))
    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    // Moved, not duplicated: a link that stayed behind on the shelf would be
    // invisible to the crew the pilot just joined.
    expect(links).toHaveLength(1)
    expect(links[0]?.gameId).toBe(gameId)
  })

  test('no-ops when the from end has no server row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    // A purely local build: Solo, or shelved and never claimed. There is
    // nothing to anchor a link to, and inventing one would be worse.
    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(0)
  })

  test("refuses to wire another player's pilot", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'A')
    const other = await makeUser(t, 'B')
    await seedPilot(t, owner.userId, 'pilot-app-1', null)

    await expect(other.as.mutation(api.entities.upsertSoftLink, LINK)).rejects.toThrow()
  })
})

describe('removeSoftLink', () => {
  test('cuts the wire', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await seedPilot(t, u.userId, 'pilot-app-1', null)

    await u.as.mutation(api.entities.upsertSoftLink, LINK)
    await u.as.mutation(api.entities.removeSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(0)
  })

  test('a wire that is already gone is not an error', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await seedPilot(t, u.userId, 'pilot-app-1', null)

    await u.as.mutation(api.entities.removeSoftLink, LINK)

    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(0)
  })
})

describe('entities.remove', () => {
  test('the owner may delete their own entity from a game', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    const pilotId = await seedPilot(t, u.userId, 'pilot-app-1', gameId)

    await u.as.mutation(api.entities.remove, { table: 'pilots', entityId: pilotId })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(0)
  })

  test("nobody may delete a crewmate's entity", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'A')
    const other = await makeUser(t, 'B')
    const pilotId = await seedPilot(t, owner.userId, 'pilot-app-1', null)

    await expect(
      other.as.mutation(api.entities.remove, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow()
  })

  test('deleting an entity takes its wires with it', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const pilotId = await seedPilot(t, u.userId, 'pilot-app-1', null)
    await u.as.mutation(api.entities.upsertSoftLink, LINK)

    await u.as.mutation(api.entities.remove, { table: 'pilots', entityId: pilotId })

    // The client has cascaded this for as long as soft links have existed; a
    // server that did not would leave the Game rendering "Unknown pilot (id)".
    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    expect(links).toHaveLength(0)
  })
})
