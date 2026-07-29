import { describe, expect, test } from 'bun:test'

import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { testConvex } from './harness'

/**
 * Setting a table up: who raises the crawler, who may add to a Game, and how an
 * offered character is picked up (ADR-030 §4–5 as amended).
 *
 * Three rules, and each one is only worth anything because it is enforced HERE
 * rather than by hiding a button:
 *
 *  1. **The table runner raises the crawler.** Every member may then edit its
 *     fields — that is what communal means — but creating and scrapping one is
 *     the act of whoever runs the table.
 *  2. **A Game takes players' pilots and mechs once it has a crawler.** A Game
 *     with none is not set up yet, and the crew has nowhere to be anchored.
 *  3. **A Mediator's pre-built character lands unclaimed, and a player takes
 *     it.** Unclaimed is an offer; claiming is accepting it. Nobody can take
 *     what a crewmate already holds.
 *
 * "Table runner" throughout means the Mediator, or the Organizer while the Game
 * has no Mediator — the narrow fallback that stops a brand-new Game being a
 * dead end.
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

/** A Game with an Organizer, a Mediator and a Player — and NO crawler yet. */
async function seedTable(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const mediator = await makeUser(t, 'Mediator')
  const player = await makeUser(t, 'Player')

  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await mediator.as.mutation(api.invites.redeem, { code })
  await player.as.mutation(api.invites.redeem, { code })
  await organizer.as.mutation(api.games.setMediator, {
    gameId,
    userId: mediator.userId,
    mediator: true,
  })

  return { organizer, mediator, player, gameId }
}

describe('the table runner raises the crawler', () => {
  test('the Mediator can raise one', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)

    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })

    const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBe(gameId)
  })

  test('a player cannot', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)

    await expect(
      player.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    ).rejects.toThrow(/only the mediator/i)
  })

  test('the Organizer can, but only while the game has no Mediator', async () => {
    const t = testConvex()
    const { organizer, mediator, gameId } = await seedTable(t)

    // A Mediator is appointed, so the fallback is closed.
    await expect(
      organizer.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    ).rejects.toThrow(/only the mediator/i)

    await organizer.as.mutation(api.games.setMediator, {
      gameId,
      userId: mediator.userId,
      mediator: false,
    })
    await organizer.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })

    const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(rows).toHaveLength(1)
  })

  test('a game may hold several crawlers', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)

    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    await mediator.as.mutation(api.entities.createCrawler, {
      gameId,
      body: crawlerBody({ id: 'c2', name: '#12 Perseverance' }),
    })

    // A campaign that loses a crawler and rebuilds, or joins a second one, is
    // ordinary play — not a state to be rejected.
    const listed = await mediator.as.query(api.entities.listForGame, { gameId })
    expect(listed.crawlers).toHaveLength(2)
  })

  test('a malformed crawler body is rejected, not stored', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)

    await expect(
      mediator.as.mutation(api.entities.createCrawler, { gameId, body: { nonsense: true } })
    ).rejects.toThrow(/invalid crawler payload/i)

    const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(rows).toHaveLength(0)
  })

  test('every member may still edit its fields', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    const crawlerId = await mediator.as.mutation(api.entities.createCrawler, {
      gameId,
      body: crawlerBody(),
    })

    // Communal editing is the whole point of the crawler; only authorship moved.
    await player.as.mutation(api.entities.patchCrawler, { crawlerId, patch: { techLevel: '2' } })

    const row = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    expect((row?.body as { techLevel: string } | undefined)?.techLevel).toBe('2')
  })

  test('a player cannot scrap it', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    const crawlerId = await mediator.as.mutation(api.entities.createCrawler, {
      gameId,
      body: crawlerBody(),
    })

    await expect(player.as.mutation(api.entities.removeCrawler, { crawlerId })).rejects.toThrow(
      /only the mediator/i
    )

    await mediator.as.mutation(api.entities.removeCrawler, { crawlerId })
    const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(rows).toHaveLength(0)
  })
})

describe('a game takes the crew once it has a crawler', () => {
  test('a player cannot add a pilot before one exists', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)

    await expect(
      player.as.mutation(api.entities.create, { table: 'pilots', gameId, body: pilotBody() })
    ).rejects.toThrow(/no union crawler yet/i)
  })

  test('and can as soon as one does', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })

    await player.as.mutation(api.entities.create, { table: 'pilots', gameId, body: pilotBody() })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.ownerId).toBe(player.userId)
  })

  test('the table runner is exempt — somebody has to go first', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)

    // If this were gated too, a new Game could never be populated at all.
    await mediator.as.mutation(api.entities.create, { table: 'pilots', gameId, body: pilotBody() })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
  })

  test('the shelf is never gated — it is your own', async () => {
    const t = testConvex()
    const { player } = await seedTable(t)

    await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId: null,
      body: pilotBody(),
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows[0]?.gameId).toBeNull()
  })

  test('the mirrored write path is gated too, or the rule would be cosmetic', async () => {
    const t = testConvex()
    const { player, gameId } = await seedTable(t)

    // The client's ordinary write path is the appId mirror. Left open, a player
    // would build the pilot locally and have the mirror place it in the Game.
    await expect(
      player.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId,
        body: pilotBody(),
      })
    ).rejects.toThrow(/no union crawler yet/i)
  })

  test('a mirrored write re-homes a build the client moved', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })

    await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId: null,
      appId: 'p1',
      body: pilotBody(),
    })
    await player.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId,
      body: pilotBody(),
    })

    // Without this the move looked like it worked locally and the server row
    // never left the shelf.
    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBe(gameId)
  })

  test('a crawler mirror merges fields but never creates a crawler', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)

    // Nothing to address yet: this must be a no-op, not a way in.
    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { techLevel: '3' },
    })
    expect(await t.run(async (ctx) => await ctx.db.query('crawlers').collect())).toHaveLength(0)

    await mediator.as.mutation(api.entities.createCrawler, {
      gameId,
      appId: 'c1',
      body: crawlerBody(),
    })
    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { techLevel: '3' },
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(rows).toHaveLength(1)
    expect((rows[0]?.body as { techLevel: string } | undefined)?.techLevel).toBe('3')
    // The merge is per field: the name it did not mention survives.
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('#430')
  })
})

describe('a mediator offers characters; players pick them up', () => {
  test('a Mediator can create one unclaimed', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)

    await mediator.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      unassigned: true,
      body: pilotBody(),
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows[0]?.ownerId).toBeNull()
  })

  test('a player cannot', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })

    await expect(
      player.as.mutation(api.entities.create, {
        table: 'pilots',
        gameId,
        unassigned: true,
        body: pilotBody(),
      })
    ).rejects.toThrow(/only the mediator/i)
  })

  test('nothing on a shelf can be unclaimed — it would belong to nobody', async () => {
    const t = testConvex()
    const { mediator } = await seedTable(t)

    // `gameId: null && ownerId: null` is the schema's one invalid combination.
    await expect(
      mediator.as.mutation(api.entities.create, {
        table: 'pilots',
        gameId: null,
        unassigned: true,
        body: pilotBody(),
      })
    ).rejects.toThrow(/shelf/i)
  })

  test('a player picks up what is offered, and it becomes theirs to edit', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    const pilotId = await mediator.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      unassigned: true,
      body: pilotBody(),
    })

    await player.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })
    await player.as.mutation(api.entities.update, {
      table: 'pilots',
      entityId: pilotId,
      body: pilotBody({ name: 'Renamed' }),
    })

    const row = await t.run(async (ctx) => await ctx.db.get(pilotId as Id<'pilots'>))
    expect(row?.ownerId).toBe(player.userId)
    expect((row?.body as { name: string } | undefined)?.name).toBe('Renamed')
  })

  test('claiming is recorded in the Change Log like any other ownership move', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    const pilotId = await mediator.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      unassigned: true,
      body: pilotBody(),
    })
    await player.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })

    const log = await t.run(async (ctx) => await ctx.db.query('changeLog').collect())
    expect(log).toHaveLength(1)
    expect(log[0]?.field).toBe('ownerId')
    expect(log[0]?.before).toBeNull()
    expect(log[0]?.after).toBe(player.userId)
    expect(log[0]?.actorId).toBe(player.userId)
  })

  test('what a crewmate already holds cannot be taken', async () => {
    const t = testConvex()
    const { organizer, mediator, player, gameId } = await seedTable(t)
    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    const pilotId = await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      body: pilotBody(),
    })

    const other = await makeUser(t, 'Latecomer')
    // Inviting is administrative, so it is the Organizer's — not the Mediator's.
    const code = await organizer.as.mutation(api.invites.create, { gameId })
    await other.as.mutation(api.invites.redeem, { code })

    await expect(
      other.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow(/already holds/i)
  })

  test('released, it is offered again and somebody else may take it', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    await mediator.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
    const pilotId = await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      body: pilotBody(),
    })

    // This is how a campaign survives somebody leaving mid-season.
    await player.as.mutation(api.ownership.release, { table: 'pilots', entityId: pilotId })
    await mediator.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })

    const row = await t.run(async (ctx) => await ctx.db.get(pilotId as Id<'pilots'>))
    expect(row?.ownerId).toBe(mediator.userId)
  })

  test('a non-member cannot claim into a game they are not in', async () => {
    const t = testConvex()
    const { mediator, gameId } = await seedTable(t)
    const pilotId = await mediator.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      unassigned: true,
      body: pilotBody(),
    })
    const outsider = await makeUser(t, 'Outsider')

    await expect(
      outsider.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })
    ).rejects.toThrow(/not a member/i)
  })

  test('claiming needs no crawler — an offer stands whatever order the table was set up in', async () => {
    const t = testConvex()
    const { mediator, player, gameId } = await seedTable(t)
    const pilotId = await mediator.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      unassigned: true,
      body: pilotBody(),
    })

    // The crawler gate governs ADDING to a game; claiming adds nothing.
    await player.as.mutation(api.ownership.claim, { table: 'pilots', entityId: pilotId })

    const row = await t.run(async (ctx) => await ctx.db.get(pilotId as Id<'pilots'>))
    expect(row?.ownerId).toBe(player.userId)
  })
})
