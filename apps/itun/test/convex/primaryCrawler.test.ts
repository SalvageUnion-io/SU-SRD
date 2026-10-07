import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  addCrawler,
  addMech,
  addPilot,
  allLinks,
  crawlerBody,
  link,
  makeUser,
  moveOwnable,
  ref,
  seedTable,
} from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * Moves and the primary crawler (ADR-037).
 *
 * Who may move what:
 *  - any member brings their own pilots and mechs into any Game they belong
 *    to — the old "the Game must have a crawler" gate is gone;
 *  - only the table runner moves a crawler, from their own shelf into a Game
 *    they run or from it back onto their shelf, and that move writes the row's
 *    `gameId`, the body's `gameId` and `ownerId` together.
 *
 * The primary crawler is where a pilot or mech is assigned on ENTERING a Game,
 * by an explicit link the server writes: on creation there, on a move in, and
 * — for the crew already gathered — when the first crawler arrives. Changing
 * the primary moves nobody.
 */

type T = ReturnType<typeof testConvex>

async function crawlerRow(t: T, appId: string) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query('crawlers')
        .withIndex('by_app_id', (q) => q.eq('appId', appId))
        .first()
  )
}

/** A row's opaque body as a record — a missing row reads as an empty one, so an assertion fails rather than throws. */
function bodyOf(row: { body: unknown } | null | undefined): Record<string, unknown> {
  return (row?.body ?? {}) as Record<string, unknown>
}

async function gameRow(t: T, gameId: Id<'games'>) {
  return await t.run(async (ctx) => await ctx.db.get(gameId))
}

function moveCrawler(
  user: Awaited<ReturnType<typeof makeUser>>,
  appId: string,
  gameId: Id<'games'> | null
) {
  return user.as.mutation(api.entities.moveCrawler, { appId, gameId })
}

describe('moves — pilots and mechs', () => {
  test('a player moves their own pilot and mech from the shelf into a Game with no crawler', async () => {
    const t = testConvex()
    const { player: p, gameId } = await seedTable(t)
    await addPilot(p, 'p1', null)
    await addMech(p, 'm1', null)

    await moveOwnable(p, 'pilots', 'p1', gameId)
    await moveOwnable(p, 'mechs', 'm1', gameId)

    const rows = await t.run(async (ctx) => ({
      pilots: await ctx.db.query('pilots').collect(),
      mechs: await ctx.db.query('mechs').collect(),
    }))
    expect(rows.pilots[0]?.gameId).toBe(gameId)
    expect(rows.mechs[0]?.gameId).toBe(gameId)
  })

  test('…into any Game they belong to, and back out to their shelf', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    const second = await o.as.mutation(api.games.create, { name: 'Second table' })
    const code = await o.as.mutation(api.invites.create, { gameId: second })
    await p.as.mutation(api.invites.redeem, { code })
    await addPilot(p, 'p1', null)

    await moveOwnable(p, 'pilots', 'p1', second)
    await moveOwnable(p, 'pilots', 'p1', gameId)
    await moveOwnable(p, 'pilots', 'p1', null)

    const pilot = await t.run(async (ctx) => await ctx.db.query('pilots').first())
    expect(pilot?.gameId).toBeNull()
    expect(pilot?.ownerId).toBe(p.userId)
  })

  test('not into a Game they are not in', async () => {
    const t = testConvex()
    const { organizer: o } = await seedTable(t)
    const theirs = await makeUser(t, 'Stranger')
    const gameId = await theirs.as.mutation(api.games.create, { name: 'Not yours' })
    await addPilot(o, 'p1', null)

    await expect(moveOwnable(o, 'pilots', 'p1', gameId)).rejects.toThrow(/not a member/i)
  })

  test("nobody moves a crewmate's pilot", async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addPilot(p, 'p1', gameId)

    await expect(moveOwnable(o, 'pilots', 'p1', null)).rejects.toThrow(ConvexError)
  })

  test('a Mediator moves their own mech like anyone else', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await o.as.mutation(api.games.setMediator, { gameId, userId: p.userId, mediator: true })
    await addMech(p, 'm1', null)

    await moveOwnable(p, 'mechs', 'm1', gameId)

    const mech = await t.run(async (ctx) => await ctx.db.query('mechs').first())
    expect(mech?.gameId).toBe(gameId)
  })
})

describe('moves — crawlers are the table runner’s', () => {
  test('in: from their own shelf into a Game they run — communal, filed in both places', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', null)

    await moveCrawler(o, 'c1', gameId)

    const row = await crawlerRow(t, 'c1')
    expect(row?.gameId).toBe(gameId)
    expect(row?.ownerId).toBeNull()
    expect(bodyOf(row).gameId).toBe(gameId)
  })

  test('out: from a Game they run onto their own shelf, where it becomes theirs', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)

    await moveCrawler(o, 'c1', null)

    const row = await crawlerRow(t, 'c1')
    expect(row?.gameId).toBeNull()
    expect(row?.ownerId).toBe(o.userId)
    expect(bodyOf(row).gameId).toBeNull()
  })

  test('a player moves no crawler — not their own in, not the table’s out', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(p, 'c-mine', null)
    await addCrawler(o, 'c-table', gameId)

    await expect(moveCrawler(p, 'c-mine', gameId)).rejects.toThrow(/only the mediator/i)
    await expect(moveCrawler(p, 'c-table', null)).rejects.toThrow(/only the mediator/i)
    expect((await crawlerRow(t, 'c-mine'))?.gameId).toBeNull()
    expect((await crawlerRow(t, 'c-table'))?.gameId).toBe(gameId)
  })

  test("the table runner cannot move somebody else's shelf crawler in", async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(p, 'c-theirs', null)

    await expect(moveCrawler(o, 'c-theirs', gameId)).rejects.toThrow(/another player/i)
  })

  test('Game to Game is two moves, not one', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    const other = await o.as.mutation(api.games.create, { name: 'Other' })
    await addCrawler(o, 'c1', gameId)

    await expect(moveCrawler(o, 'c1', other)).rejects.toThrow(/my stuff first/i)
  })

  test('a field patch never moves a crawler — its gameId is ignored', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)

    await o.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { gameId: null, name: 'Renamed' },
    })

    const row = await crawlerRow(t, 'c1')
    expect(row?.gameId).toBe(gameId)
    expect(bodyOf(row).gameId).toBe(gameId)
    expect(bodyOf(row).name).toBe('Renamed')
  })

  test('moving a crawler out drops the crew links that would straddle', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addPilot(p, 'p1', gameId) // auto-assigned to c1

    await moveCrawler(o, 'c1', null)

    expect(await allLinks(t)).toEqual([])
  })
})

describe('the primary crawler', () => {
  test('the first crawler raised is primary; the second is not', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    const first = await addCrawler(o, 'c1', gameId)
    await addCrawler(o, 'c2', gameId)

    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe(first)
  })

  test('a crawler moved into a Game with none becomes primary', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', null)

    await moveCrawler(o, 'c1', gameId)

    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe((await crawlerRow(t, 'c1'))?._id)
  })

  test('scrapping the primary falls back to the oldest crawler left, then to none', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    const c1 = await addCrawler(o, 'c1', gameId)
    const c2 = await addCrawler(o, 'c2', gameId)
    const c3 = await addCrawler(o, 'c3', gameId)
    await o.as.mutation(api.games.setPrimaryCrawler, { gameId, crawlerId: c3 })

    await o.as.mutation(api.entities.removeCrawler, { crawlerId: c3 })
    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe(c1)

    await o.as.mutation(api.entities.removeCrawlerByAppId, { appId: 'c1' })
    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe(c2)

    await o.as.mutation(api.entities.removeCrawler, { crawlerId: c2 })
    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBeNull()
  })

  test('moving the primary out falls back too', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    const c2 = await addCrawler(o, 'c2', gameId)

    await moveCrawler(o, 'c1', null)

    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe(c2)
  })

  test('a pilot or mech created in a Game is assigned to its primary', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)

    await addPilot(p, 'p1', gameId)
    await addMech(p, 'm1', gameId)

    expect(await allLinks(t)).toEqual([
      { type: 'pilot-to-crawler', from: 'p1', to: 'c1', gameId },
      { type: 'mech-to-crawler', from: 'm1', to: 'c1', gameId },
    ])
  })

  test('…and so is one moved in from the shelf', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addMech(p, 'm1', null)

    await moveOwnable(p, 'mechs', 'm1', gameId)

    expect(await allLinks(t)).toEqual([{ type: 'mech-to-crawler', from: 'm1', to: 'c1', gameId }])
  })

  test('nothing is assigned on the shelf', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)

    await addPilot(o, 'p-shelf', null)

    expect(await allLinks(t)).toEqual([])
  })

  test('the first crawler takes aboard the crew that gathered before it', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addPilot(p, 'p1', gameId)
    await addMech(p, 'm1', gameId)
    await addPilot(o, 'p2', gameId)

    await addCrawler(o, 'c1', gameId)

    expect((await allLinks(t)).sort((a, b) => a.from.localeCompare(b.from))).toEqual([
      { type: 'mech-to-crawler', from: 'm1', to: 'c1', gameId },
      { type: 'pilot-to-crawler', from: 'p1', to: 'c1', gameId },
      { type: 'pilot-to-crawler', from: 'p2', to: 'c1', gameId },
    ])
  })

  test('a second crawler takes nobody', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addPilot(p, 'p1', gameId)

    await addCrawler(o, 'c2', gameId)

    expect(await allLinks(t)).toEqual([{ type: 'pilot-to-crawler', from: 'p1', to: 'c1', gameId }])
  })

  test('changing the primary moves nobody; only later arrivals go to the new one', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    const c2 = await addCrawler(o, 'c2', gameId)
    await addPilot(p, 'p-before', gameId)

    await o.as.mutation(api.games.setPrimaryCrawler, { gameId, crawlerId: c2 })
    await addPilot(p, 'p-after', gameId)

    const links = await allLinks(t)
    expect(links.find((l) => l.from === 'p-before')?.to).toBe('c1')
    expect(links.find((l) => l.from === 'p-after')?.to).toBe('c2')
  })

  test('a player may still reassign their own pilot to any crawler in the Game', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addCrawler(o, 'c2', gameId)
    await addPilot(p, 'p1', gameId)

    await link(p, ref.pilot('p1'), ref.crawler('c2'), 'pilot-to-crawler')

    expect(await allLinks(t)).toEqual([{ type: 'pilot-to-crawler', from: 'p1', to: 'c2', gameId }])
  })

  test('setPrimaryCrawler is the table runner’s, and only for a crawler in that Game', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    const c2 = await addCrawler(o, 'c2', gameId)
    const elsewhere = await addCrawler(o, 'c-shelf', null)

    await expect(
      p.as.mutation(api.games.setPrimaryCrawler, { gameId, crawlerId: c2 })
    ).rejects.toThrow(/only the mediator/i)
    await expect(
      o.as.mutation(api.games.setPrimaryCrawler, { gameId, crawlerId: elsewhere })
    ).rejects.toThrow(/not in this game/i)
  })

  test('the Games list names the primary, and follows it when it changes', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await o.as.mutation(api.entities.createCrawler, {
      gameId,
      appId: 'c1',
      body: crawlerBody('c1', gameId, 'Tenacity'),
    })
    const second = await o.as.mutation(api.entities.createCrawler, {
      gameId,
      appId: 'c2',
      body: crawlerBody('c2', gameId, 'Second Wind'),
    })
    expect((await o.as.query(api.games.get, { gameId }))?.crawlerName).toBe('Tenacity')

    await o.as.mutation(api.games.setPrimaryCrawler, { gameId, crawlerId: second })

    expect((await o.as.query(api.games.get, { gameId }))?.crawlerName).toBe('Second Wind')
  })

  test('listForGame says which crawler is primary; listMine says who runs each table', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    const c1 = await addCrawler(o, 'c1', gameId)

    expect((await p.as.query(api.entities.listForGame, { gameId })).primaryCrawlerId).toBe(c1)
    expect((await o.as.query(api.games.listMine, {}))[0]?.tableRunner).toBe(true)
    expect((await p.as.query(api.games.listMine, {}))[0]?.tableRunner).toBe(false)
  })

  test('a Game started from a template has its crawler as primary', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    const gameId = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })

    const crawler = await t.run(
      async (ctx) =>
        await ctx.db
          .query('crawlers')
          .withIndex('by_game', (q) => q.eq('gameId', gameId))
          .first()
    )
    expect((await gameRow(t, gameId))?.primaryCrawlerId).toBe(crawler?._id)
  })
})
