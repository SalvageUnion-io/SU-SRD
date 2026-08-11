import { describe, expect, test } from 'bun:test'
import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { testConvex } from './harness'

/**
 * Entity reads and writes against the server of record.
 *
 * Two properties carry the weight here:
 *
 *  1. **Every write Zod-parses first.** The schema stores bodies as `v.any()`
 *     so the Zod schemas stay the single source of truth, which means Convex
 *     itself cannot reject a malformed body — the mutation must. If that check
 *     is ever dropped, nothing else in the system will notice until a corrupt
 *     row reaches a sheet and blanks it.
 *  2. **Reading is per-Game, writing is per-entity.** Any member sees the whole
 *     crew (which is what makes vitals and drill-in possible), but nobody
 *     writes a crewmate's sheet — a Mediator wanting to change one goes through
 *     a proposal, not a privileged write path.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/**
 * A minimal body that satisfies PilotSchema.
 *
 * Derived by probing the real schema rather than guessed — the first draft of
 * this fixture invented fields (`currentHp`, `trainingPoints`, `abilityRefs`)
 * that do not exist on it and omitted required ones (`classRef`, `motto`,
 * `keepsake`, `appearance`), so every case failed at the parse step.
 */
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

/**
 * A game a player may actually put builds into.
 *
 * The crawler is not scene-setting — it is a precondition. `assertMayAddToContainer`
 * refuses a player's pilot or mech until the Game has one, on the grounds that
 * a Game with no crawler is not yet set up (the table runner is exempt, since
 * somebody has to raise the first one). Seeding a game without it produces
 * "This game has no Union Crawler yet" from every player-side write, which
 * reads like a permissions failure and is not.
 */
async function seedGame(t: Ctx) {
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  await organizer.as.mutation(api.entities.createCrawler, {
    gameId,
    body: {
      id: 'seed-crawler',
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: '#430',
      techLevel: '1',
      systems: [],
    },
  })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  return { organizer, player, gameId }
}

describe('every write Zod-parses first', () => {
  test('a malformed pilot body is rejected, not stored', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await expect(
      u.as.mutation(api.entities.create, {
        table: 'pilots',
        gameId: null,
        body: { nonsense: true },
      })
    ).rejects.toThrow(/invalid pilots payload/i)

    // Nothing partial left behind.
    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(0)
  })

  test('a well-formed pilot body is stored', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await u.as.mutation(api.entities.create, { table: 'pilots', gameId: null, body: pilotBody() })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.gameId).toBeNull()
    expect(rows[0]?.ownerId).toBe(u.userId)
  })
})

describe('reading is per-game, writing is per-entity', () => {
  test('a member sees the whole crew, including entities they do not own', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await player.as.mutation(api.entities.create, { table: 'pilots', gameId, body: pilotBody() })

    const seen = await organizer.as.query(api.entities.listForGame, { gameId })
    // This is what makes crew vitals and read-only drill-in possible.
    expect(seen.pilots).toHaveLength(1)
  })

  test('a non-member sees nothing', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')

    await expect(outsider.as.query(api.entities.listForGame, { gameId })).rejects.toThrow(
      /not a member/i
    )
  })

  test("a crewmate cannot write another player's pilot", async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const pilotId = await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      body: pilotBody(),
    })

    await expect(
      organizer.as.mutation(api.entities.update, {
        table: 'pilots',
        entityId: pilotId,
        body: pilotBody({ name: 'Hijacked' }),
      })
    ).rejects.toThrow(/another player/i)
  })

  test('an unclaimed entity cannot be edited until it is assigned', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const pilotId = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: null,
          body: pilotBody(),
          updatedAt: 1,
        })
    )

    // Editing an unclaimed pre-gen would let anyone quietly take it without
    // going through assignment, which is the act the Change Log records.
    await expect(
      organizer.as.mutation(api.entities.update, {
        table: 'pilots',
        entityId: pilotId,
        body: pilotBody({ name: 'Mine now' }),
      })
    ).rejects.toThrow(/unclaimed/i)
  })

  test('the owner can write their own', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      body: pilotBody(),
    })

    await player.as.mutation(api.entities.update, {
      table: 'pilots',
      entityId: pilotId,
      body: pilotBody({ name: 'Renamed' }),
    })

    const row = await t.run(async (ctx) => await ctx.db.get(pilotId as Id<'pilots'>))
    expect(row).not.toBeNull()
    expect((row?.body as { name: string } | undefined)?.name).toBe('Renamed')
  })
})

describe('the crawler is communal and merges per field', () => {
  test('two members editing different fields do not clobber each other', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          appId: 'crawler-app-1',
          // Shape probed against CrawlerSchema, not guessed: techLevel is a
          // STRING here, there is no `modules` key, and `systems` is required.
          body: {
            id: 'c1',
            schemaVersion: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            name: '#430',
            techLevel: '1',
            systems: [],
          },
          updatedAt: 1,
        })
    )

    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'crawler-app-1',
      patch: { name: 'Tenacity' },
    })
    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'crawler-app-1',
      patch: { techLevel: '2' },
    })

    const row = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    const body = row?.body as { name: string; techLevel: string; id: string }

    // Both survive. A full-body write would have discarded whichever member
    // lost the race — on exactly the night it matters, during Downtime.
    expect(body.name).toBe('Tenacity')
    expect(body.techLevel).toBe('2')
    expect(body.id).toBe('c1')
  })

  test('a non-member cannot touch the crawler', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          appId: 'crawler-app-2',
          body: {},
          updatedAt: 1,
        })
    )

    // The member gate is asked BEFORE the body is merged and parsed, which is
    // why an empty body is enough to make this case: if the gate ever moved
    // after the parse, this would start failing on a schema error instead and
    // stop testing what it says it tests.
    await expect(
      outsider.as.mutation(api.entities.patchCrawlerByAppId, {
        appId: 'crawler-app-2',
        patch: { scrap: 999 },
      })
    ).rejects.toThrow(/not a member/i)
  })
})

describe('claiming local data on first sign-in', () => {
  test('everything lands on the shelf, never in a game', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    const result = await u.as.mutation(api.entities.claimLocal, {
      pilots: [pilotBody(), pilotBody({ id: 'p2' })],
      mechs: [],
    })

    expect(result.claimed).toBe(2)
    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    // Guessing a Game for a build that has no relationship to any crew would be
    // worse than making the person place it deliberately.
    expect(rows.every((r) => r.gameId === null)).toBe(true)
  })

  test('one corrupt record is skipped rather than costing the whole roster', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    const result = await u.as.mutation(api.entities.claimLocal, {
      pilots: [pilotBody(), { totally: 'broken' }, pilotBody({ id: 'p3' })],
      mechs: [],
    })

    expect(result.claimed).toBe(2)
    expect(result.skipped).toBe(1)
  })

  test('an anonymous caller cannot claim', async () => {
    const t = testConvex()
    await expect(t.mutation(api.entities.claimLocal, { pilots: [], mechs: [] })).rejects.toThrow(
      /not signed in/i
    )
  })
})
