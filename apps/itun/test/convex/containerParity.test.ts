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
import schema from '../../convex/schema'
import { STORE_NAMES } from '../../src/lib/db/stores'

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

  test('the exemption is still real — `workspaces` has no Convex table', () => {
    // A negative control. If `workspaces` ever gains a server table the
    // exemption is obsolete and should be deleted, not carried forward.
    expect(convexTables().has('workspaces')).toBe(false)
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
