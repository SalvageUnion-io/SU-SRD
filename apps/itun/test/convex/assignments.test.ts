import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api, internal } from '../../convex/_generated/api'
import { CROSS_CONTAINER_REFUSAL } from '../../src/lib/links/linkRules'
import {
  addCrawler,
  addMech,
  addPilot,
  allLinks,
  link,
  makeUser,
  moveOwnable,
  ref,
  seedTable,
} from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * The assignment model, server side (ADR-037).
 *
 * Three invariants hold for every soft link the server writes, and each is
 * pinned here at the mutation that keeps it:
 *
 *  - **direct links** — a mech's crawler is its own `mech-to-crawler` link,
 *    not its pilot's crawler;
 *  - **cardinality** — a pilot crews ≤1 crawler and flies ≤1 mech, a mech
 *    flies ≤1 pilot and docks in ≤1 crawler, and drawing a link REPLACES the
 *    ones it conflicts with in the same mutation;
 *  - **one container** — both ends in the same Game or the same owner's shelf,
 *    refused when drawn across, pruned when a move would leave one straddling.
 *
 * Then the way down: `listWiring` returns every link the caller can see and
 * the crawlers of their Games.
 */

describe('mech-to-crawler', () => {
  test('a mech docks in a crawler by its own link, with no pilot involved', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addMech(u, 'm1', null)
    await addCrawler(u, 'c1', null)

    await link(u, ref.mech('m1'), ref.crawler('c1'), 'mech-to-crawler')

    expect(await allLinks(t)).toEqual([
      { type: 'mech-to-crawler', from: 'm1', to: 'c1', gameId: null },
    ])
  })

  test('a type that does not match its ends is a defect, not a write', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addPilot(u, 'p1', null)
    await addCrawler(u, 'c1', null)

    await expect(link(u, ref.pilot('p1'), ref.crawler('c1'), 'mech-to-crawler')).rejects.toThrow()
    expect(await allLinks(t)).toEqual([])
  })
})

describe('cardinality — a new assignment replaces the one it conflicts with', () => {
  test('a pilot crews one crawler: assigning a second moves them', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addCrawler(o, 'c2', gameId)
    await addPilot(o, 'p1', gameId)

    await link(o, ref.pilot('p1'), ref.crawler('c1'), 'pilot-to-crawler')
    await link(o, ref.pilot('p1'), ref.crawler('c2'), 'pilot-to-crawler')

    expect(await allLinks(t)).toEqual([{ type: 'pilot-to-crawler', from: 'p1', to: 'c2', gameId }])
  })

  test('a mech docks in one crawler', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addMech(u, 'm1', null)
    await addCrawler(u, 'c1', null)
    await addCrawler(u, 'c2', null)

    await link(u, ref.mech('m1'), ref.crawler('c1'), 'mech-to-crawler')
    await link(u, ref.mech('m1'), ref.crawler('c2'), 'mech-to-crawler')

    expect((await allLinks(t)).map((l) => l.to)).toEqual(['c2'])
  })

  test('a mech flies one pilot, and a pilot flies one mech', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addMech(u, 'm1', null)
    await addMech(u, 'm2', null)
    await addPilot(u, 'p1', null)
    await addPilot(u, 'p2', null)

    await link(u, ref.mech('m1'), ref.pilot('p1'), 'mech-to-pilot')
    // The mech's end: m1 now flies p2, so m1→p1 goes.
    await link(u, ref.mech('m1'), ref.pilot('p2'), 'mech-to-pilot')
    expect(await allLinks(t)).toEqual([
      { type: 'mech-to-pilot', from: 'm1', to: 'p2', gameId: null },
    ])

    // The pilot's end: p2 now flies m2, so m1→p2 goes.
    await link(u, ref.mech('m2'), ref.pilot('p2'), 'mech-to-pilot')
    expect(await allLinks(t)).toEqual([
      { type: 'mech-to-pilot', from: 'm2', to: 'p2', gameId: null },
    ])
  })

  test('a crawler takes a whole crew and a whole bay', async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addPilot(o, 'p-o', gameId)
    await addPilot(p, 'p-p', gameId)
    await addMech(o, 'm-o', gameId)
    await addMech(p, 'm-p', gameId)

    await link(o, ref.pilot('p-o'), ref.crawler('c1'), 'pilot-to-crawler')
    await link(p, ref.pilot('p-p'), ref.crawler('c1'), 'pilot-to-crawler')
    await link(o, ref.mech('m-o'), ref.crawler('c1'), 'mech-to-crawler')
    await link(p, ref.mech('m-p'), ref.crawler('c1'), 'mech-to-crawler')

    expect(await allLinks(t)).toHaveLength(4)
  })

  test('drawing the same link twice is one link', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addMech(u, 'm1', null)
    await addCrawler(u, 'c1', null)

    await link(u, ref.mech('m1'), ref.crawler('c1'), 'mech-to-crawler')
    await link(u, ref.mech('m1'), ref.crawler('c1'), 'mech-to-crawler')

    expect(await allLinks(t)).toHaveLength(1)
  })

  test("nobody bumps a crewmate's mech off a crewmate's pilot", async () => {
    const t = testConvex()
    // No crawler: nothing is auto-assigned, so only the links drawn here exist.
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addPilot(p, 'p-p', gameId)
    await addMech(p, 'm-p', gameId)
    await addMech(o, 'm-o', gameId)
    await link(p, ref.mech('m-p'), ref.pilot('p-p'), 'mech-to-pilot')

    const refused = await o.as
      .mutation(api.entities.upsertSoftLink, {
        from: ref.mech('m-o'),
        to: ref.pilot('p-p'),
        type: 'mech-to-pilot',
      })
      .catch((err: unknown) => err)
    // A player-facing refusal, and nothing changed.
    expect(refused).toBeInstanceOf(ConvexError)
    expect(await allLinks(t)).toEqual([{ type: 'mech-to-pilot', from: 'm-p', to: 'p-p', gameId }])
  })

  test("a pilot's owner decides which mech flies them, even a crewmate's", async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addPilot(o, 'p-o', gameId)
    await addMech(p, 'm-p', gameId)
    await addMech(o, 'm-o', gameId)
    await link(p, ref.mech('m-p'), ref.pilot('p-o'), 'mech-to-pilot')

    await link(o, ref.mech('m-o'), ref.pilot('p-o'), 'mech-to-pilot')

    expect(await allLinks(t)).toEqual([{ type: 'mech-to-pilot', from: 'm-o', to: 'p-o', gameId }])
  })
})

describe('one container — both ends share a Game or the same shelf', () => {
  test('a shelf pilot cannot be assigned to a crawler in a Game', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addPilot(o, 'p1', null)

    const refused = await o.as
      .mutation(api.entities.upsertSoftLink, {
        from: ref.pilot('p1'),
        to: ref.crawler('c1'),
        type: 'pilot-to-crawler',
      })
      .catch((err: unknown) => err)

    expect(refused).toBeInstanceOf(ConvexError)
    expect((refused as ConvexError<string>).data).toBe(CROSS_CONTAINER_REFUSAL)
    expect(await allLinks(t)).toEqual([])
  })

  test('…nor to a crawler in a different Game', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    const other = await o.as.mutation(api.games.create, { name: 'Elsewhere' })
    await addCrawler(o, 'c-other', other)
    await addPilot(o, 'p1', gameId)

    await expect(
      link(o, ref.pilot('p1'), ref.crawler('c-other'), 'pilot-to-crawler')
    ).rejects.toThrow(CROSS_CONTAINER_REFUSAL)
  })

  test("My Stuff is per person: nobody docks in somebody else's shelf crawler", async () => {
    const t = testConvex()
    const a = await makeUser(t, 'A')
    const b = await makeUser(t, 'B')
    await addMech(a, 'm-a', null)
    await addCrawler(b, 'c-b', null)

    await expect(link(a, ref.mech('m-a'), ref.crawler('c-b'), 'mech-to-crawler')).rejects.toThrow(
      CROSS_CONTAINER_REFUSAL
    )
  })

  test('a target with no server row is not written — its claim will bring the wiring', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addPilot(u, 'p1', null)

    await link(u, ref.pilot('p1'), ref.crawler('not-uploaded'), 'pilot-to-crawler')

    expect(await allLinks(t)).toEqual([])
  })
})

describe('a move prunes the links it would leave straddling two containers', () => {
  test('moving a pilot into a Game drops its shelf wiring', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addPilot(o, 'p1', null)
    await addMech(o, 'm1', null)
    await addCrawler(o, 'c-shelf', null)
    await link(o, ref.mech('m1'), ref.pilot('p1'), 'mech-to-pilot')
    await link(o, ref.pilot('p1'), ref.crawler('c-shelf'), 'pilot-to-crawler')
    await link(o, ref.mech('m1'), ref.crawler('c-shelf'), 'mech-to-crawler')

    await moveOwnable(o, 'pilots', 'p1', gameId)

    // The pilot's two links had their other end left on the shelf; the mech's
    // own crawler link never touched the pilot and stays.
    expect(await allLinks(t)).toEqual([
      { type: 'mech-to-crawler', from: 'm1', to: 'c-shelf', gameId: null },
    ])
  })

  test('a link whose other end is already in the destination comes along, re-filed', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addMech(o, 'm1', null)
    // Written raw: the same-container rule would refuse it today. This is the
    // shape a pre-ADR-037 roster can still hold.
    await t.run(
      async (ctx) =>
        await ctx.db.insert('softLinks', {
          gameId: null,
          from: ref.mech('m1'),
          to: ref.crawler('c1'),
          type: 'mech-to-crawler',
        })
    )

    await moveOwnable(o, 'mechs', 'm1', gameId)

    expect(await allLinks(t)).toEqual([{ type: 'mech-to-crawler', from: 'm1', to: 'c1', gameId }])
  })

  test('an ordinary edit is not a move and prunes nothing', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addPilot(u, 'p1', null)
    await addCrawler(u, 'c1', null)
    await link(u, ref.pilot('p1'), ref.crawler('c1'), 'pilot-to-crawler')

    await moveOwnable(u, 'pilots', 'p1', null)

    expect(await allLinks(t)).toHaveLength(1)
  })
})

describe('scrapping a crawler takes its crew links with it', () => {
  test('removeCrawler', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    const crawlerId = await addCrawler(o, 'c1', gameId)
    await addPilot(o, 'p1', gameId)
    await addMech(o, 'm1', gameId)
    await link(o, ref.pilot('p1'), ref.crawler('c1'), 'pilot-to-crawler')
    await link(o, ref.mech('m1'), ref.crawler('c1'), 'mech-to-crawler')

    await o.as.mutation(api.entities.removeCrawler, { crawlerId })

    expect(await allLinks(t)).toEqual([])
  })

  test("a template crawler's scrap leaves its twin's crew alone in another Game", async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Organizer')
    // Two Games from one template: their rows carry the SAME body ids, and so
    // do their links.
    const first = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const second = await u.as.mutation(api.templates.createGame, { templateId: 'starter-set' })
    const before = (await allLinks(t)).filter((l) => l.gameId === second).length
    const crawler = await t.run(
      async (ctx) =>
        await ctx.db
          .query('crawlers')
          .withIndex('by_game', (q) => q.eq('gameId', first))
          .first()
    )
    if (crawler === null) throw new Error('template raised no crawler')

    await u.as.mutation(api.entities.removeCrawler, { crawlerId: crawler._id })

    const links = await allLinks(t)
    expect(links.filter((l) => l.gameId === second)).toHaveLength(before)
    expect(links.filter((l) => l.gameId === first && l.to === crawler.body.id)).toEqual([])
  })

  test('removeCrawlerByAppId', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await addCrawler(u, 'c1', null)
    await addPilot(u, 'p1', null)
    await link(u, ref.pilot('p1'), ref.crawler('c1'), 'pilot-to-crawler')

    await u.as.mutation(api.entities.removeCrawlerByAppId, { appId: 'c1' })

    expect(await allLinks(t)).toEqual([])
  })
})

describe('listWiring — the way down', () => {
  test("returns your own links, your Games' links and crawlers — and nobody else's", async () => {
    const t = testConvex()
    const { organizer: o, player: p, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addPilot(p, 'p-p', gameId)
    await addMech(p, 'm-p', gameId)
    // Drawn by the player — the Organizer must still see it.
    await link(p, ref.pilot('p-p'), ref.crawler('c1'), 'pilot-to-crawler')
    await link(p, ref.mech('m-p'), ref.crawler('c1'), 'mech-to-crawler')
    // The Organizer's own shelf wiring.
    await addPilot(o, 'p-o', null)
    await addCrawler(o, 'c-o', null)
    await link(o, ref.pilot('p-o'), ref.crawler('c-o'), 'pilot-to-crawler')

    // A stranger's shelf and a stranger's Game — neither is the Organizer's.
    const stranger = await makeUser(t, 'Stranger')
    await addPilot(stranger, 'p-s', null)
    await addCrawler(stranger, 'c-s', null)
    await link(stranger, ref.pilot('p-s'), ref.crawler('c-s'), 'pilot-to-crawler')
    const theirGame = await stranger.as.mutation(api.games.create, { name: 'Theirs' })
    await addCrawler(stranger, 'c-theirs', theirGame)

    const wiring = await o.as.query(api.entities.listWiring, {})

    expect(wiring.gameIds).toEqual([gameId])
    expect(wiring.softLinks.map((l) => `${l.type}:${l.from.id}>${l.to.id}`).sort()).toEqual([
      'mech-to-crawler:m-p>c1',
      'pilot-to-crawler:p-o>c-o',
      'pilot-to-crawler:p-p>c1',
    ])
    expect(wiring.crawlers.map((c) => c.appId)).toEqual(['c1'])
    expect(wiring.crawlers[0]?.gameId).toBe(gameId)
  })

  test('requires a signed-in caller', async () => {
    const t = testConvex()
    await expect(t.query(api.entities.listWiring, {})).rejects.toThrow(/not signed in/i)
  })
})

describe('claimLocal keeps the invariants too', () => {
  test('a roster that wired one pilot to two crawlers arrives with one', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.claim.claimLocal, {
      pilots: [pilotOnShelf('p1')],
      mechs: [],
      crawlers: [crawlerOnShelf('c1'), crawlerOnShelf('c2')],
      softLinks: [
        { id: 'l1', from: ref.pilot('p1'), to: ref.crawler('c1'), type: 'pilot-to-crawler' },
        { id: 'l2', from: ref.pilot('p1'), to: ref.crawler('c2'), type: 'pilot-to-crawler' },
      ],
    })

    expect(await allLinks(t)).toEqual([
      { type: 'pilot-to-crawler', from: 'p1', to: 'c2', gameId: null },
    ])
  })

  test('a link to something already in a Game is declined, not written', async () => {
    const t = testConvex()
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c-game', gameId)

    const result = await o.as.mutation(api.claim.claimLocal, {
      pilots: [pilotOnShelf('p1')],
      mechs: [],
      softLinks: [
        { id: 'l1', from: ref.pilot('p1'), to: ref.crawler('c-game'), type: 'pilot-to-crawler' },
      ],
    })

    expect(result.declined).toBe(1)
    expect(result.skipped).toBe(0)
    expect(await allLinks(t)).toEqual([])
  })
})

describe('maintenance.repairSoftLinks', () => {
  /** Rows written raw, bypassing every writer — the state pre-ADR-037 code could leave. */
  async function seedLegacy(t: ReturnType<typeof testConvex>) {
    const { organizer: o, gameId } = await seedTable(t)
    await addCrawler(o, 'c1', gameId)
    await addCrawler(o, 'c2', gameId)
    await addPilot(o, 'p1', gameId)
    await addMech(o, 'm1', gameId)
    await addCrawler(o, 'c-shelf', null)
    // Wipe what the writers drew (the primary crawler assignment) so only the
    // raw legacy rows below exist.
    await t.run(async (ctx) => {
      for (const l of await ctx.db.query('softLinks').collect()) await ctx.db.delete(l._id)
    })
    await t.run(async (ctx) => {
      const put = (
        type: 'mech-to-pilot' | 'pilot-to-crawler' | 'mech-to-crawler',
        from: { type: 'pilot' | 'mech'; id: string },
        to: { type: 'pilot' | 'crawler'; id: string },
        filed: typeof gameId | null
      ) => ctx.db.insert('softLinks', { gameId: filed, from, to, type })
      // The two-hop the old model read as "m1 is docked in c2".
      await put('mech-to-pilot', ref.mech('m1'), ref.pilot('p1'), gameId)
      // p1 on two crawlers: the older (c1) loses to the newer (c2).
      await put('pilot-to-crawler', ref.pilot('p1'), ref.crawler('c1'), gameId)
      await put('pilot-to-crawler', ref.pilot('p1'), ref.crawler('c2'), null)
      // A duplicate of the mech's pilot link.
      await put('mech-to-pilot', ref.mech('m1'), ref.pilot('p1'), gameId)
    })
    // Added after the others so it is the NEWEST mech-to-crawler candidate the
    // pilot could offer — and it crosses containers, so it simply goes.
    await t.run(
      async (ctx) =>
        await ctx.db.insert('softLinks', {
          gameId,
          from: ref.mech('m-ghost'),
          to: ref.crawler('c1'),
          type: 'mech-to-crawler',
        })
    )
    await t.run(
      async (ctx) =>
        await ctx.db.insert('softLinks', {
          gameId,
          from: ref.pilot('p1'),
          to: ref.crawler('c-shelf'),
          type: 'pilot-to-crawler',
        })
    )
    return { gameId }
  }

  test('reports and changes nothing by default', async () => {
    const t = testConvex()
    await seedLegacy(t)
    const before = await allLinks(t)

    const report = await t.action(internal.maintenance.repairSoftLinks, {})

    expect(report.applied).toBe(false)
    expect(report.links.duplicates).toBe(1)
    expect(report.links.crossContainer).toBe(1)
    expect(report.links.orphaned).toBe(1)
    expect(await allLinks(t)).toEqual(before)
  })

  test('applied: the invariants hold afterwards, and every docked mech has its own link', async () => {
    const t = testConvex()
    const { gameId } = await seedLegacy(t)

    const report = await t.action(internal.maintenance.repairSoftLinks, {
      apply: true,
      pageSize: 2,
    })

    expect(report.applied).toBe(true)
    expect(report.backfill.backfilled).toBe(1)
    const after = (await allLinks(t)).filter((l) => l.from !== 'm-ghost')
    expect(after.sort((a, b) => a.type.localeCompare(b.type))).toEqual([
      // Docked in c2: its pilot's surviving crawler.
      { type: 'mech-to-crawler', from: 'm1', to: 'c2', gameId },
      { type: 'mech-to-pilot', from: 'm1', to: 'p1', gameId },
      // The newest crew link survived and was re-filed under its container.
      { type: 'pilot-to-crawler', from: 'p1', to: 'c2', gameId },
    ])

    // Idempotent: a second applied run has nothing left to do.
    const again = await t.action(internal.maintenance.repairSoftLinks, { apply: true })
    expect(again.links.duplicates + again.links.crossContainer).toBe(0)
    expect(again.links.overCardinality + again.links.rehomed).toBe(0)
    expect(again.backfill.backfilled).toBe(0)
  })
})

function pilotOnShelf(id: string) {
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
    gameId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function crawlerOnShelf(id: string) {
  return {
    id,
    schemaVersion: 1,
    name: `Crawler ${id}`,
    techLevel: '1',
    systems: [],
    gameId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
