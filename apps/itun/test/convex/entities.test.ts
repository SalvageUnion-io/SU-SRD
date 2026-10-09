import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { FIXTURE_NOW } from '../../src/components/__tests__/fixtures'
import type { Ctx } from './fixtures'
import { crawlerBody, makeUser, pilotBody, seedTable } from './fixtures'
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

/**
 * A minimal body that satisfies MechPatternSchema.
 *
 * This fixture used to be `{ id, name }`, and it passed — patterns once went
 * in unparsed, so the test was asserting that a body nothing would later be
 * able to read was accepted.
 */
function patternBody(over: Record<string, unknown> = {}) {
  return {
    id: 'pat1',
    schemaVersion: 1,
    name: 'Mule loadout',
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
    ...over,
  }
}

/**
 * A Game that is **set up**: crew invited and a crawler raised.
 *
 * The crawler is not decoration. A player may only add pilots and mechs to a
 * Game that has one, so a fixture without it is a Game nobody can play in —
 * every "the owner can write their own" case would fail at the create step, on
 * a rule that has nothing to do with what it is testing. Raising it here keeps
 * those tests about what they say they are about; the gate itself is proven
 * directly in `tableSetup.test.ts`.
 */
async function seedGame(t: Ctx) {
  const table = await seedTable(t)
  // The Organizer runs the table while the Game has no Mediator appointed.
  await table.organizer.as.mutation(api.entities.createCrawler, {
    gameId: table.gameId,
    body: crawlerBody(),
  })
  return table
}

/**
 * Mirror a pilot up the way the client does, and return its server id.
 *
 * `upsertByAppId` is the one path a client creates and edits an ownable entity
 * through — a generic `create` / `update` pair that no client called was
 * removed — so the tests exercise the rules where they are actually enforced.
 */
async function mirrorPilot(
  t: Ctx,
  user: { as: ReturnType<Ctx['withIdentity']> },
  gameId: Id<'games'> | null,
  body: Record<string, unknown> = pilotBody()
): Promise<Id<'pilots'>> {
  const appId = String(body.id)
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'pilots',
    appId,
    gameId,
    body,
    expectedUpdatedAt: null,
  })
  const row = await t.run(
    async (ctx) =>
      await ctx.db
        .query('pilots')
        .withIndex('by_app_id', (q) => q.eq('appId', appId))
        .first()
  )
  if (row === null) throw new Error(`pilot ${appId} was not mirrored`)
  return row._id
}

describe('every write Zod-parses first', () => {
  test('a malformed pilot body is rejected, not stored', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await expect(
      u.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId: null,
        body: { nonsense: true },
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/invalid pilots payload/i)

    // Nothing partial left behind.
    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(0)
  })

  test('a well-formed pilot body is stored', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await mirrorPilot(t, u, null)

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
    await mirrorPilot(t, player, gameId)

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
    await mirrorPilot(t, player, gameId)

    await expect(
      organizer.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId,
        body: pilotBody({ name: 'Hijacked' }),
        expectedUpdatedAt: null,
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
          appId: 'p1',
          body: pilotBody(),
          updatedAt: 1,
        })
    )

    // Editing an unclaimed pre-gen would let anyone quietly take it without
    // going through a claim, which is the act the Change Log records.
    await expect(
      organizer.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId,
        body: pilotBody({ name: 'Mine now' }),
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/unclaimed/i)
    const row = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect((row?.body as { name: string } | undefined)?.name).toBe('Roach-Boy')
  })

  test('the owner can write their own', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await mirrorPilot(t, player, gameId)

    await mirrorPilot(t, player, gameId, pilotBody({ name: 'Renamed' }))

    const row = await t.run(async (ctx) => await ctx.db.get(pilotId))
    expect(row).not.toBeNull()
    expect((row?.body as { name: string } | undefined)?.name).toBe('Renamed')
  })

  test("an id from another table cannot be reached through the table it isn't in", async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await mirrorPilot(t, player, gameId)

    // A Convex id is table-tagged, but `db.get` returns a document from ANY
    // table — so a handler that casts the string would fetch this pilot
    // through the MECH endpoint and act on it as if it were one.
    await expect(
      player.as.mutation(api.entities.remove, { table: 'mechs', entityId: pilotId })
    ).rejects.toThrow(/no longer exists/i)
    expect(await t.run(async (ctx) => await ctx.db.get(pilotId))).not.toBeNull()
  })

  test('a row from a table this endpoint does not serve is not writable at all', async () => {
    const t = testConvex()
    const { player } = await seedGame(t)
    // Owned by the caller, so the ownership check would have passed it: the
    // table tag is the only thing standing between a pattern and the mech
    // write path.
    const patternId = await t.run(
      async (ctx) =>
        await ctx.db.insert('mechPatterns', {
          ownerId: player.userId,
          gameId: null,
          appId: 'pattern-1',
          body: { id: 'pattern-1', name: 'Draft' },
        })
    )

    await expect(
      player.as.mutation(api.entities.remove, { table: 'mechs', entityId: patternId })
    ).rejects.toThrow(/no longer exists/i)
    expect(await t.run(async (ctx) => await ctx.db.get(patternId))).not.toBeNull()
  })
})

describe("the crawler is the table runner's and merges per field", () => {
  test('two edits to different fields do not clobber each other', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          appId: 'c1',
          // Shape probed against CrawlerSchema, not guessed: techLevel is a
          // STRING here, there is no `modules` key, and `systems` is required.
          body: crawlerBody(),
          updatedAt: 1,
        })
    )

    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { name: 'Tenacity' },
    })
    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { techLevel: '2' },
    })

    const row = await t.run(async (ctx) => await ctx.db.get(crawlerId))
    const body = row?.body as { name: string; techLevel: string; id: string }

    // Both survive. A full-body write from a stale copy would have discarded
    // whichever edit it did not know about.
    expect(body.name).toBe('Tenacity')
    expect(body.techLevel).toBe('2')
    expect(body.id).toBe('c1')
  })

  test('a cleared field reaches the server: ↺ on a pinned Max SP drops the pin', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedGame(t)
    const crawlerId = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          appId: 'c1',
          body: crawlerBody(),
          updatedAt: 1,
        })
    )
    const crawlerBodyOnServer = async () =>
      (await t.run(async (ctx) => await ctx.db.get(crawlerId)))?.body as
        | Record<string, unknown>
        | undefined

    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { maxSpOverride: 30 },
    })
    expect((await crawlerBodyOnServer())?.maxSpOverride).toBe(30)

    // The revert as the client used to send it. The Convex client drops an
    // undefined field when it serialises the args, so this is `{}` on the wire
    // — and the pin survives. That is the bug `unset` exists for.
    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { maxSpOverride: undefined },
    })
    expect((await crawlerBodyOnServer())?.maxSpOverride).toBe(30)

    // The revert as the client sends it now.
    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
      patch: { maxSpOverride: undefined },
      unset: ['maxSpOverride'],
    })
    const body = await crawlerBodyOnServer()
    expect(body && 'maxSpOverride' in body).toBe(false)
    // Only the named field went; the rest of the body is untouched.
    expect(body?.name).toBe('#430')

    // An unknown name is refused rather than silently stripping a key…
    await expect(
      organizer.as.mutation(api.entities.patchCrawlerByAppId, {
        appId: 'c1',
        patch: {},
        unset: ['notAField'],
      })
    ).rejects.toThrow(/cannot unset unknown field "notAField"/)
    // …and a required field cannot be unset: the merged body must still parse.
    await expect(
      organizer.as.mutation(api.entities.patchCrawlerByAppId, {
        appId: 'c1',
        patch: {},
        unset: ['name'],
      })
    ).rejects.toThrow(/Invalid crawlers payload/)
    expect((await crawlerBodyOnServer())?.name).toBe('#430')
  })

  test('a player cannot touch the crawler; the table runner can', async () => {
    const t = testConvex()
    const { organizer, player, gameId } = await seedGame(t)
    await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          appId: 'c9',
          body: crawlerBody({ id: 'c9' }),
          updatedAt: 1,
        })
    )
    const nameOnServer = async () => {
      const rows = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
      return (rows.find((r) => r.appId === 'c9')?.body as { name?: string } | undefined)?.name
    }

    // ADR-038 §5: players read the crawler and ask at the table.
    await expect(
      player.as.mutation(api.entities.patchCrawlerByAppId, {
        appId: 'c9',
        patch: { name: 'Mine now' },
      })
    ).rejects.toThrow(/only the mediator/i)
    expect(await nameOnServer()).toBe('#430')
    // With no Mediator appointed, the Organizer runs the table and keeps it.
    await organizer.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c9',
      patch: { name: 'Tenacity' },
    })
    expect(await nameOnServer()).toBe('Tenacity')
  })

  test('a non-member cannot touch the crawler', async () => {
    const t = testConvex()
    const { gameId } = await seedGame(t)
    const outsider = await makeUser(t, 'Outsider')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          appId: 'c1',
          body: {},
          updatedAt: 1,
        })
    )

    await expect(
      outsider.as.mutation(api.entities.patchCrawlerByAppId, {
        appId: 'c1',
        patch: { scrap: 999 },
      })
    ).rejects.toThrow(/not a member/i)
  })
})

/**
 * Whether a refusal is fit to leave the deployment.
 *
 * Convex redacts a plain `Error` thrown from a production function down to
 * "[CONVEX M(fn)] Server Error" before any client sees it, and propagates a
 * `ConvexError`'s `data` intact. Every authorization message in this repo was
 * therefore written, thrown, and discarded at the boundary — a player who tried
 * something the rules refuse got the same opaque string as a genuine crash.
 *
 * This cannot be observed through `convex-test`, which runs in-process and so
 * never serializes anything. What it *can* pin is the property the wire
 * behaviour depends on: the error carries its message as `ConvexError` data.
 */
describe('refusals say why', () => {
  test('an authorization failure crosses the wire as ConvexError data', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const stranger = await makeUser(t, 'Stranger')

    await owner.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })
    const pilotId = await t.run(async (ctx) => (await ctx.db.query('pilots').first())?._id)

    expect(pilotId).toBeDefined()

    const err = await stranger.as
      .mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId: null,
        body: pilotBody({ name: 'not yours' }),
        expectedUpdatedAt: null,
      })
      .then(
        () => null,
        (e: unknown) => e
      )

    expect(err).toBeInstanceOf(ConvexError)
    // The `data` field is the whole mechanism: it is what Convex sends on, and
    // what `serverMessage()` reads on the client.
    expect((err as ConvexError<string>).data).toMatch(/cannot edit another player/i)
  })
})
/**
 * Patterns and shelf NPCs are addressed by the id inside their body, which the
 * `appId` column now carries so the lookup is one indexed read rather than a
 * scan of everything the owner holds.
 */
describe('patterns and shelf NPCs mirror by their body id', () => {
  test('a pattern saved twice is one row, carrying its id as appId', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.shelf.upsertMechPattern, { body: patternBody() })
    await u.as.mutation(api.shelf.upsertMechPattern, {
      body: patternBody({ name: 'Mule, revised' }),
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.appId).toBe('pat1')
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('Mule, revised')

    await u.as.mutation(api.shelf.removeMechPattern, { patternId: 'pat1' })
    expect(await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())).toEqual([])
  })

  test("somebody else's row with the same id is neither found nor touched", async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const them = await makeUser(t, 'Them')
    await them.as.mutation(api.shelf.upsertMechPattern, { body: patternBody() })

    // Export/import copies a build between people keeping its id, so two
    // owners legitimately share one. Scoping by owner is what keeps them apart.
    await me.as.mutation(api.shelf.removeMechPattern, { patternId: 'pat1' })
    await me.as.mutation(api.shelf.upsertMechPattern, { body: patternBody({ name: 'Mine' }) })

    const rows = await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())
    expect(rows).toHaveLength(2)
    const theirs = rows.find((r) => r.ownerId === them.userId)
    expect((theirs?.body as { name: string } | undefined)?.name).toBe('Mule loadout')
  })

  test('a shelf NPC upserts and removes by its body id the same way', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.shelf.upsertEncounterNpc, { body: { id: 'npc1', name: 'Wretch' } })
    await u.as.mutation(api.shelf.upsertEncounterNpc, {
      body: { id: 'npc1', name: 'Wretch, wounded' },
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.appId).toBe('npc1')

    await u.as.mutation(api.shelf.removeEncounterNpc, { npcId: 'npc1' })
    expect(await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())).toEqual([])
  })
})
