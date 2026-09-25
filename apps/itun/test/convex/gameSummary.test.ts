import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

/**
 * `games.summary` — the badges the Games list draws, kept on the Game itself.
 *
 * `games.listMine` used to count every membership, pilot, mech and crawler of
 * every Game the caller belonged to, on every run. It is a reactive query, so
 * reading all those rows also subscribed the list to every sheet in every one
 * of those Games: an HP tick anywhere re-ran it for everybody at the table.
 *
 * The summary is now stored on the `games` row and kept current by triggers on
 * the four tables it counts. The properties worth pinning are therefore the
 * two halves of that trade: **every roster change reaches the summary** (or a
 * badge is quietly wrong forever), and **an ordinary sheet edit does not touch
 * the Game at all** (or the churn is back).
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
    name: 'Roach-Boy',
    callsign: 'Roach-Boy',
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

function crawlerBody(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    schemaVersion: 1,
    name: '#430',
    techLevel: '1',
    systems: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

/** A Game with an Organizer (running the table, no Mediator) and a Player. */
async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

async function storedSummary(t: Ctx, gameId: Id<'games'>) {
  return await t.run(async (ctx) => (await ctx.db.get(gameId))?.summary ?? null)
}

describe('every roster change reaches the stored summary', () => {
  test('joining, raising a crawler and adding a pilot are all counted', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    expect(await storedSummary(t, gameId)).toEqual({
      memberCount: 2,
      pilotCount: 0,
      mechCount: 0,
      crawlerName: null,
    })

    await organizer.as.mutation(api.entities.createCrawler, {
      gameId,
      appId: 'c1',
      body: crawlerBody(),
    })
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId,
      body: pilotBody(),
    })

    expect(await storedSummary(t, gameId)).toEqual({
      memberCount: 2,
      pilotCount: 1,
      mechCount: 0,
      crawlerName: '#430',
    })
    const [listed] = await player.as.query(api.games.listMine, {})
    expect(listed).toMatchObject({ memberCount: 2, pilotCount: 1, crawlerName: '#430' })
  })

  test('moving a pilot out to the shelf and deleting one both count down', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    for (const id of ['p1', 'p2']) {
      await player.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: id,
        gameId,
        body: pilotBody({ id }),
      })
    }
    expect((await storedSummary(t, gameId))?.pilotCount).toBe(2)

    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId: null,
      body: pilotBody({ id: 'p1' }),
    })
    expect((await storedSummary(t, gameId))?.pilotCount).toBe(1)

    await player.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'p2' })
    expect((await storedSummary(t, gameId))?.pilotCount).toBe(0)
  })

  test('renaming the crawler is reflected; filling its bays is not a change', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.entities.createCrawler, {
      gameId,
      appId: 'c1',
      body: crawlerBody(),
    })

    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { name: 'Perseverance' },
    })
    expect((await storedSummary(t, gameId))?.crawlerName).toBe('Perseverance')

    const before = await t.run(async (ctx) => await ctx.db.get(gameId))
    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { techLevel: '2' },
    })
    expect(await t.run(async (ctx) => await ctx.db.get(gameId))).toEqual(before)
  })

  test('a Game seeded from a template is counted from the start', async () => {
    const t = testConvex()
    const organizer = await makeUser(t, 'Organizer')
    const [template] = await organizer.as.query(api.templates.list, {})
    if (template === undefined) throw new Error('no built-in template to seed from')

    const gameId = await organizer.as.mutation(api.templates.createGame, {
      templateId: template.id,
      name: 'From a template',
    })

    const live = await t.run(async (ctx) => ({
      pilots: (
        await ctx.db
          .query('pilots')
          .withIndex('by_game', (q) => q.eq('gameId', gameId))
          .collect()
      ).length,
      mechs: (
        await ctx.db
          .query('mechs')
          .withIndex('by_game', (q) => q.eq('gameId', gameId))
          .collect()
      ).length,
    }))
    const stored = await storedSummary(t, gameId)
    expect(stored?.memberCount).toBe(1)
    expect(stored?.pilotCount).toBe(live.pilots)
    expect(stored?.mechCount).toBe(live.mechs)
  })
})

describe('an ordinary sheet edit does not touch the Game', () => {
  test("a pilot's own fields change without writing the games row", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await organizer.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId,
      body: pilotBody(),
    })
    const before = await t.run(async (ctx) => await ctx.db.get(gameId))

    // Convex bumps nothing on a document that is not written, so comparing the
    // whole row is comparing "was it written" — which is what re-runs a query.
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId,
      body: pilotBody({ name: 'Took a hit' }),
    })
    const after = await t.run(async (ctx) => await ctx.db.get(gameId))
    expect(after).toEqual(before)
  })
})

describe('a Game that predates the column', () => {
  /** Rows written straight to the table bypass the triggers, as history did. */
  async function legacyGame(t: Ctx) {
    const me = await makeUser(t, 'Me')
    const gameId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('games', { name: 'Old table' })
      await ctx.db.insert('memberships', {
        gameId: id,
        userId: me.userId,
        mediator: true,
        organizer: true,
        joinedAt: 1,
      })
      await ctx.db.insert('pilots', { gameId: id, ownerId: null, body: {}, updatedAt: 1 })
      await ctx.db.insert('crawlers', {
        gameId: id,
        ownerId: null,
        body: { name: 'Old' },
        updatedAt: 1,
      })
      return id
    })
    return { me, gameId }
  }

  test('lists with a live count until it is backfilled', async () => {
    const t = testConvex()
    const { me, gameId } = await legacyGame(t)
    expect(await storedSummary(t, gameId)).toBeNull()

    const [listed] = await me.as.query(api.games.listMine, {})
    expect(listed).toMatchObject({
      memberCount: 1,
      pilotCount: 1,
      mechCount: 0,
      crawlerName: 'Old',
    })
  })

  test('the backfill stores it, and a second run writes nothing', async () => {
    const t = testConvex()
    const { gameId } = await legacyGame(t)

    const first = await t.action(internal.maintenance.backfillGameSummaries, { pageSize: 1 })
    expect(first.updated).toBe(1)
    expect(await storedSummary(t, gameId)).toEqual({
      memberCount: 1,
      pilotCount: 1,
      mechCount: 0,
      crawlerName: 'Old',
    })

    const second = await t.action(internal.maintenance.backfillGameSummaries, {})
    expect(second.updated).toBe(0)
  })
})
