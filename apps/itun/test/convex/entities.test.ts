import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
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

/** A minimal body that satisfies MechSchema. */
function mechBody(over: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    schemaVersion: 1,
    name: 'Iron Mongrel',
    chassisRef: 'iron-mongrel',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    currentSP: 12,
    currentHeat: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

/**
 * A minimal body that satisfies MechPatternSchema.
 *
 * This fixture used to be `{ id, name }`, and it passed — patterns were the one
 * claimed kind that went in unparsed, so the test was asserting that a body
 * nothing would later be able to read was accepted.
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
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

/** A minimal body that satisfies CrawlerSchema — techLevel is a STRING. */
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
  const organizer = await makeUser(t, 'Organizer')
  const player = await makeUser(t, 'Player')
  const gameId = await organizer.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await organizer.as.mutation(api.invites.create, { gameId })
  await player.as.mutation(api.invites.redeem, { code })
  // The Organizer runs the table while the Game has no Mediator appointed.
  await organizer.as.mutation(api.entities.createCrawler, { gameId, body: crawlerBody() })
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

  test("an id from another table cannot be written through the table it isn't in", async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    const pilotId = await player.as.mutation(api.entities.create, {
      table: 'pilots',
      gameId,
      body: pilotBody(),
    })

    // A Convex id is table-tagged, but `db.get` returns a document from ANY
    // table — so a handler that casts the string would fetch this pilot, parse
    // the payload with the MECH schema, and patch it back over the pilot.
    await expect(
      player.as.mutation(api.entities.update, {
        table: 'mechs',
        entityId: pilotId,
        body: mechBody(),
      })
    ).rejects.toThrow(/no longer exists/i)
  })

  test('a row from a table this endpoint does not serve is not writable at all', async () => {
    const t = testConvex()
    const { player, gameId } = await seedGame(t)
    // Owned by the caller, so the ownership check would have passed it: the
    // table tag is the only thing standing between a pattern and the mech
    // write path.
    const patternId = await t.run(
      async (ctx) =>
        await ctx.db.insert('mechPatterns', {
          ownerId: player.userId,
          gameId,
          body: { name: 'Draft' },
        })
    )

    await expect(
      player.as.mutation(api.entities.update, {
        table: 'mechs',
        entityId: patternId,
        body: mechBody(),
      })
    ).rejects.toThrow(/no longer exists/i)
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
          ownerId: null,
          appId: 'c1',
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
      appId: 'c1',
      patch: { name: 'Tenacity' },
    })
    await player.as.mutation(api.entities.patchCrawlerByAppId, {
      appId: 'c1',
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

describe('claiming a legacy roster carries the whole thing', () => {
  test('crawler, soft links and patterns come across, not just pilots and mechs', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'Returning player')

    const result = await u.as.mutation(api.entities.claimLocal, {
      pilots: [pilotBody()],
      mechs: [],
      crawlers: [
        {
          id: 'c1',
          schemaVersion: 1,
          name: '#430',
          techLevel: '1',
          systems: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      softLinks: [
        {
          from: { type: 'pilot', id: 'p1' },
          to: { type: 'crawler', id: 'c1' },
          type: 'pilot-to-crawler',
        },
      ],
      mechPatterns: [patternBody()],
    })

    // The first version of this mutation took only pilots and mechs, so a
    // returning player would have watched their crawler and every link between
    // their entities disappear with no error.
    expect(result.byKind.pilots).toBe(1)
    expect(result.byKind.crawlers).toBe(1)
    expect(result.byKind.softLinks).toBe(1)
    expect(result.byKind.mechPatterns).toBe(1)
    expect(result.skipped).toBe(0)
  })

  test("a claimed crawler lands on the claimer's shelf, like everything else", async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await u.as.mutation(api.entities.claimLocal, {
      pilots: [],
      mechs: [],
      crawlers: [
        {
          id: 'c1',
          schemaVersion: 1,
          name: '#430',
          techLevel: '1',
          systems: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    // This used to park the crawler on a placeholder "Claimed crawler" Game of
    // one, because `crawlers.gameId` was non-nullable and a shelf could not hold
    // it. The shelf can hold one now, so a claimed crawler goes exactly where a
    // claimed pilot goes — and no Game is invented to receive it.
    const crawlers = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    expect(crawlers).toHaveLength(1)
    expect(crawlers[0]?.gameId).toBeNull()
    expect(crawlers[0]?.ownerId).toBe(u.userId)

    const games = await t.run(async (ctx) => await ctx.db.query('games').collect())
    const memberships = await t.run(async (ctx) => await ctx.db.query('memberships').collect())
    expect(games).toHaveLength(0)
    expect(memberships).toHaveLength(0)
  })

  test('the local id is preserved as appId so later edits find the row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await u.as.mutation(api.entities.claimLocal, { pilots: [pilotBody()], mechs: [] })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    // Without this, the very first edit after a claim could not address its row.
    expect(rows[0]?.appId).toBe('p1')
  })

  test('a malformed pattern is skipped rather than stored unread', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const result = await u.as.mutation(api.entities.claimLocal, {
      pilots: [],
      mechs: [],
      mechPatterns: [patternBody(), { id: 'pat2', name: 'no chassis' }],
    })

    expect(result.byKind.mechPatterns).toBe(1)
    expect(result.skipped).toBe(1)
    const rows = await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())
    expect(rows).toHaveLength(1)
  })

  test('a malformed crawler is skipped without costing the rest of the roster', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const result = await u.as.mutation(api.entities.claimLocal, {
      pilots: [pilotBody()],
      mechs: [],
      crawlers: [{ nonsense: true }],
    })
    expect(result.byKind.pilots).toBe(1)
    expect(result.skipped).toBe(1)
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

    await owner.as.mutation(api.entities.claimLocal, { pilots: [pilotBody()], mechs: [] })
    const pilotId = await t.run(async (ctx) => (await ctx.db.query('pilots').first())?._id)

    const err = await stranger.as
      .mutation(api.entities.update, {
        table: 'pilots',
        entityId: pilotId as string,
        body: pilotBody({ name: 'not yours' }),
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
 * Claiming the same roster twice.
 *
 * This is not a hypothetical: the only thing that ever stopped a second claim
 * was a `localStorage` marker, and the card that writes it is deliberately
 * re-offered on a second device. A player signing in on a laptop after their
 * phone ran the whole claim again.
 *
 * The cost was permanent and silent. `byAppId` and `patchCrawlerByAppId` use
 * `.unique()`, which throws on a second row with the same app id, so from the
 * moment a roster was duplicated **every mirrored write for those entities
 * failed** — while the local write kept succeeding, leaving the app looking
 * healthy as IndexedDB and the server of record drifted apart for good.
 */
describe('claiming twice is a no-op, not a second copy', () => {
  const crawler = crawlerBody()

  test('the second claim copies nothing and says so', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const roster = { pilots: [pilotBody(), pilotBody({ id: 'p2' })], mechs: [mechBody()] }

    const first = await u.as.mutation(api.entities.claimLocal, roster)
    const second = await u.as.mutation(api.entities.claimLocal, roster)

    expect(first.claimed).toBe(3)
    expect(second.claimed).toBe(0)
    // Reported separately from `skipped`, which means "could not be read" —
    // telling a player their roster was unreadable when it is simply already
    // there would be a worse lie than the silence this replaced.
    expect(second.alreadyPresent).toBe(3)
    expect(second.skipped).toBe(0)

    const pilots = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    const mechs = await t.run(async (ctx) => await ctx.db.query('mechs').collect())
    expect(pilots).toHaveLength(2)
    expect(mechs).toHaveLength(1)
  })

  test('the mirror still works after a repeat claim — the bug this fixes', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.entities.claimLocal, { pilots: [pilotBody()], mechs: [] })
    await u.as.mutation(api.entities.claimLocal, { pilots: [pilotBody()], mechs: [] })

    // Before the guard this threw `unique() query returned more than one
    // result from table pilots`, redacted to an opaque "Server Error" on the
    // client and swallowed by the fire-and-forget mirror. Every edit to this
    // pilot was lost from that point on, with nothing shown to anyone.
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId: null,
      body: pilotBody({ name: 'Edited after the second claim' }),
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe(
      'Edited after the second claim'
    )
  })

  test('a repeat claim of a crawler makes no second copy, and no game at all', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.entities.claimLocal, { pilots: [], mechs: [], crawlers: [crawler] })
    await u.as.mutation(api.entities.claimLocal, { pilots: [], mechs: [], crawlers: [crawler] })

    // Two regressions in one assertion, and the second is now structural rather
    // than guarded. Claiming twice must not duplicate the crawler — that check
    // is unchanged. It must also not accumulate placeholder Games, which it once
    // did on EVERY re-claim: a "Claimed crawler" Game was raised before anything
    // checked whether a crawler was left to put in it. No placeholder exists to
    // raise any more, so the count is zero rather than a carefully-held one.
    const crawlers = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    const games = await t.run(async (ctx) => await ctx.db.query('games').collect())
    const memberships = await t.run(async (ctx) => await ctx.db.query('memberships').collect())
    expect(crawlers).toHaveLength(1)
    expect(games).toHaveLength(0)
    expect(memberships).toHaveLength(0)
  })

  test('soft links and patterns are not duplicated either', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    const roster = {
      pilots: [],
      mechs: [],
      crawlers: [crawler],
      softLinks: [
        {
          from: { type: 'pilot', id: 'p1' },
          to: { type: 'crawler', id: 'c1' },
          type: 'pilot-to-crawler',
        },
      ],
      mechPatterns: [patternBody()],
    }

    await u.as.mutation(api.entities.claimLocal, roster)
    const second = await u.as.mutation(api.entities.claimLocal, roster)

    expect(second.claimed).toBe(0)
    const links = await t.run(async (ctx) => await ctx.db.query('softLinks').collect())
    const patterns = await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())
    // A link has no app id — it IS its endpoints — so identity is the
    // (from, to, kind) triple. Nothing calls `.unique()` here, but a roster
    // that drew the same pilot-to-crawler link twice is still wrong.
    expect(links).toHaveLength(1)
    expect(patterns).toHaveLength(1)
  })
})
