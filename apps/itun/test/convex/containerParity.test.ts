/**
 * The standing gate for ADR-034 decision 2: **every local store has somewhere
 * on the server to live.**
 *
 * ## Why this test exists rather than a code review habit
 *
 * Three stores drifted into holding records the server had never heard of —
 * `mechPatterns`, `encounterNpcs` and the Change Log — and none of them was a
 * decision anybody made. Each was a store added locally where wiring it up was
 * a separate step that never happened, and nothing anywhere failed as a result.
 * A rule that only lives in prose gets followed until the day somebody is busy.
 *
 * So this asserts the *shape* rather than the wiring: for every IndexedDB object
 * store there is a Convex table that could receive it. It deliberately does NOT
 * assert that writes are mirrored — that is P4's job and would fail today by
 * design (see `docs/architecture/persistence-and-pwa.md`). What it catches is
 * the cheaper and more common mistake: adding store number nine and forgetting
 * the server entirely.
 *
 * ## Reading a failure
 *
 * If this fails you have added a local store with no server counterpart. The fix
 * is a Convex table, not an entry in the exemption list. The exemption list has
 * exactly one member and adding a second one needs a very good reason written
 * down beside it.
 */

import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import { STORE_NAMES } from '../../src/lib/db/stores'
import { testConvex } from './harness'

/**
 * The little of a Convex column validator this test reads.
 *
 * Deliberately structural rather than imported: the concrete `VUnion`/`VId`
 * generics are an implementation detail whose type parameters change with the
 * schema, and naming them here would make this file need editing every time a
 * table gains a column.
 */
type ContainerColumn = { kind?: string; members?: readonly { kind?: string }[] }

/**
 * Local stores that legitimately have no Convex counterpart.
 *
 * `workspaces` is the retired pre-ADR-030 container. The object store survives
 * only so migrations v10 and v13 still run against databases that predate the
 * split; nothing writes it and nothing reads it as live data, so there is
 * nothing for a server table to hold.
 */
const NO_SERVER_COUNTERPART = new Set<string>(['workspaces'])

/** The tables the Convex schema actually declares. */
function convexTables(): Set<string> {
  return new Set(Object.keys(schema.tables))
}

describe('container parity — every local store can reach the server', () => {
  test('every IndexedDB store has a Convex table, except the retired one', () => {
    const tables = convexTables()
    const orphans = Object.values(STORE_NAMES).filter(
      (name) => !tables.has(name) && !NO_SERVER_COUNTERPART.has(name)
    )

    expect(orphans).toEqual([])
  })

  test('the exemption list has not quietly grown', () => {
    // Named separately from the check above so that *widening the exemption*
    // fails on its own line rather than hiding inside a passing parity test.
    // Adding a store here is the exact move this file exists to make expensive.
    expect([...NO_SERVER_COUNTERPART]).toEqual(['workspaces'])
  })

  /**
   * A table is not a writer, and that gap is why P4b could read `done` for
   * weeks while three stores never reached the server.
   *
   * The check above asks only "does a Convex table exist with this name". Both
   * `mechPatterns` and `encounterNpcs` passed it from P0 onward while every
   * client write went to IndexedDB and stopped there — the tables existed and
   * nothing wrote to them except the bulk claim at sign-in. The gate agreed
   * with the plan's `done`, and the plan's own body said the work was still
   * outstanding.
   *
   * So this asserts the other half: for every store that has a table, some
   * client code must actually commit to it. Deliberately a source scan rather
   * than a runtime probe — the failure being caught is "nobody wrote the
   * mirror", which is a fact about the code, not about a session.
   */
  test('every mirrored store has a client commit path, not just a table', async () => {
    const backend = await Bun.file(
      new URL('../../src/stores/entityBackend.ts', import.meta.url)
    ).text()

    // store name → the commit function that must reference it
    const WRITERS: Record<string, string> = {
      pilots: 'commitEntityWrite',
      mechs: 'commitEntityWrite',
      crawlers: 'commitEntityWrite',
      softLinks: 'commitSoftLink',
      mechPatterns: 'commitPatternWrite',
      encounterNpcs: 'commitNpcWrite',
      changeLog: 'commitChangeLog',
    }

    const missing = Object.entries(WRITERS)
      .filter(([, fn]) => !backend.includes(`export async function ${fn}(`))
      .map(([store, fn]) => `${store} -> ${fn}`)

    expect(missing).toEqual([])
  })

  test('every store with a table appears in the writer map', () => {
    // Keeps the map above honest: adding a store with a Convex table but no
    // entry here would otherwise pass the writer check by not being asked
    // about — the same shape as the table-only gap it replaces.
    const tables = convexTables()
    const mapped = new Set([
      'pilots',
      'mechs',
      'crawlers',
      'softLinks',
      'mechPatterns',
      'encounterNpcs',
      'changeLog',
    ])
    const unmapped = Object.values(STORE_NAMES).filter(
      (name) => tables.has(name) && !mapped.has(name) && !NO_SERVER_COUNTERPART.has(name)
    )

    expect(unmapped).toEqual([])
  })

  test('the exemption is still real — `workspaces` has no Convex table', () => {
    // A negative control. If `workspaces` ever gains a server table the
    // exemption is obsolete and should be deleted, not carried forward.
    expect(convexTables().has('workspaces')).toBe(false)
  })

  /**
   * The assertion that protects a deploy against a live database.
   *
   * Convex validates **every existing document** against the schema when it is
   * pushed. `crawlers` and `encounterNpcs` gained an `ownerId` long after both
   * tables had production rows, so a *required* column there would have made
   * the deploy fail on rows that are otherwise perfectly valid — and the failure
   * would arrive at deploy time, against real data, which is the worst place to
   * discover it.
   *
   * `publicRead` two columns above already records this rule ("the correct
   * default for every row that already exists"); these tests are that rule made
   * executable, so the next person to add a column to a populated table finds
   * out here instead of in production.
   */
  test('a row written before ownerId existed still validates', async () => {
    const t = testConvex()

    await t.run(async (ctx) => {
      const gameId = await ctx.db.insert('games', { name: 'Legacy table' })

      // Exactly the shape a pre-#871 crawler has on disk: no `ownerId` key at
      // all, not `ownerId: null`. If this throws, the schema is not deployable
      // against the existing database.
      await ctx.db.insert('crawlers', {
        gameId,
        body: { name: '#430' },
        updatedAt: 1,
      } as never)

      await ctx.db.insert('encounterNpcs', {
        gameId,
        body: { name: 'Ambush' },
      } as never)
    })

    const crawlers = await t.run(async (ctx) => await ctx.db.query('crawlers').collect())
    const npcs = await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())
    expect(crawlers).toHaveLength(1)
    expect(npcs).toHaveLength(1)
  })

  test('absent ownerId is treated as unowned, never as a match', async () => {
    const t = testConvex()
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', { name: 'Me' }))

    await t.run(async (ctx) => {
      await ctx.db.insert('crawlers', {
        gameId: null,
        body: { name: 'Orphan' },
        updatedAt: 1,
      } as never)
    })

    // `listMine` reads `by_owner`, and a row with no `ownerId` must not come
    // back for anybody. Every comparison against `ownerId` in the codebase is
    // an equality test, so absent fails closed — which is the direction that
    // cannot leak somebody else's build into a roster.
    const mine = await t.withIdentity({ subject: userId }).query(api.entities.listMine, {})
    expect(mine.crawlers).toEqual([])
  })

  /**
   * The two containers, asserted structurally.
   *
   * ADR-030 §2 allows `gameId` set (in a Game) or null (on a shelf), and
   * ADR-034 decision 2 extends that to every entity-shaped table — which is
   * what let a crawler survive a deleted Game (#871) and, in this change, an
   * encounter NPC too. A table that can only be in a Game cannot express the
   * shelf half, and that is precisely the gap both of those had.
   */
  test('every entity-shaped table can express BOTH containers', () => {
    const ENTITY_TABLES = ['pilots', 'mechs', 'crawlers', 'encounterNpcs', 'mechPatterns'] as const

    for (const name of ENTITY_TABLES) {
      const table = schema.tables[name]
      expect(table).toBeDefined()

      // `validator.fields` is the public, typed column map — one validator per
      // column, each carrying a `kind` and, for a union, its `members`. Read
      // through this rather than the runtime-only `.json`, which is not on the
      // public type and would need a cast to reach.
      const columns: Record<string, ContainerColumn> = table.validator.fields

      expect(Object.keys(columns)).toContain('gameId')
      expect(Object.keys(columns)).toContain('ownerId')

      // A shelf is `gameId: null`, so the column must be a union admitting
      // null — a bare `v.id('games')` is the shape that could not hold a shelf,
      // and is what both `crawlers` and `encounterNpcs` had to be changed from.
      const gameId = columns.gameId
      expect(gameId?.kind).toBe('union')
      expect(gameId?.members?.map((m) => m.kind)).toContain('null')
    }
  })
})
