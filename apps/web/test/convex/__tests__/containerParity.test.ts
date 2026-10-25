/**
 * The standing gate for ADR-034 decision 2: **every kind of record the replica
 * holds has somewhere on the server to live.**
 *
 * ## Why this test exists rather than a code review habit
 *
 * Three stores drifted into holding records the server had never heard of —
 * `mechPatterns`, `encounterNpcs` and the Change Log — and none of them was a
 * decision anybody made. Each was a store added locally where wiring it up was
 * a separate step that never happened, and nothing anywhere failed as a result.
 * A rule that only lives in prose gets followed until the day somebody is busy.
 *
 * So this asserts both halves: for every record kind (`RECORD_KINDS`) there is
 * a Convex table that could receive it, and a client send in `src/replica/outbox.ts`
 * that the replica's API actually calls. The first catches the cheaper and
 * more common mistake: adding a table and forgetting the server entirely.
 *
 * ## Reading a failure
 *
 * If this fails you have added a local record kind with no server counterpart.
 * The fix is a Convex table. There is no exemption list.
 */

import { describe, expect, test } from 'bun:test'
import schema from '../../../convex/schema'
import { RECORD_KINDS } from '../../../src/replica/records'
import type { Table } from '../../../src/replica/replica'

/**
 * The little of a Convex column validator this test reads.
 *
 * Deliberately structural rather than imported: the concrete `VUnion`/`VId`
 * generics are an implementation detail whose type parameters change with the
 * schema, and naming them here would make this file need editing every time a
 * table gains a column.
 */
type ContainerColumn = { kind?: string; members?: readonly { kind?: string }[] }

/** The table name each record kind's rows live under. */
const KIND_NAMES = Object.values(RECORD_KINDS).map((k) => k.name)

/** The tables the Convex schema actually declares. */
function convexTables(): Set<string> {
  return new Set(Object.keys(schema.tables))
}

describe('container parity — every replica table can reach the server', () => {
  test('every record kind has a Convex table', () => {
    const tables = convexTables()
    expect(KIND_NAMES.filter((name) => !tables.has(name))).toEqual([])
  })

  /**
   * A table is not a writer, and that gap is why P4b could read `done` for
   * weeks while three stores never reached the server.
   *
   * The check above asks only "does a Convex table exist with this name". Both
   * `mechPatterns` and `encounterNpcs` passed it while every client write went
   * to the device and stopped there — the tables existed and nothing wrote to
   * them except the bulk claim at sign-in. The gate was green while the work
   * was still outstanding.
   *
   * So this asserts the other half: for every store that has a table, some
   * client code must actually commit to it. Deliberately a source scan rather
   * than a runtime probe — the failure being caught is "nobody wrote the
   * commit", which is a fact about the code, not about a session.
   */
  /**
   * A table is not a writer: `mechPatterns` and `encounterNpcs` once had
   * tables while every client write stopped on the device. So for every
   * replica table, the send must be declared in `outbox.ts` AND called (or
   * wired) by the module that writes that table. Keyed by `Table`, so a new
   * table does not typecheck until it names its writer.
   */
  test('every replica table has a client send that is called, not just a table', async () => {
    const WRITERS: Record<Table | 'ops' | 'changeLog', { fn: string; consumer: string }> = {
      pilot: { fn: 'sendRow', consumer: 'replica/units.ts' },
      mech: { fn: 'sendRow', consumer: 'replica/units.ts' },
      crawler: { fn: 'sendRow', consumer: 'replica/units.ts' },
      npc: { fn: 'sendRow', consumer: 'replica/units.ts' },
      softLink: { fn: 'sendLink', consumer: 'replica/units.ts' },
      mechPattern: { fn: 'sendPattern', consumer: 'replica/collections.ts' },
      encounterNpc: { fn: 'sendTrayNpc', consumer: 'replica/collections.ts' },
      encounter: { fn: 'sendEncounter', consumer: 'replica/collections.ts' },
      // A unit's change is an op (ADR-063); the Change Log table keeps Play's rolls.
      ops: { fn: 'sendOp', consumer: 'replica/units.ts' },
      changeLog: { fn: 'sendChangeLog', consumer: 'play/usePlayChannel.ts' },
    }
    const read = (path: string) => Bun.file(new URL(`../../../src/${path}`, import.meta.url)).text()
    const outbox = await read('replica/outbox.ts')

    const undeclared = Object.entries(WRITERS)
      .filter(([, { fn }]) => !outbox.includes(`export async function ${fn}(`))
      .map(([table, { fn }]) => `${table} -> ${fn} is not declared in outbox.ts`)

    // Comments, imports and re-exports name a function without using it: a
    // trailing `// was sendPattern` is what switching a send off looks like.
    const strip = (source: string) =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/\bimport\s+(?:type\s+)?[\s\S]*?\bfrom\s*['"][^'"]*['"]/g, ' ')
        .replace(/\bexport\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"]/g, ' ')
    // A use is a call (`fn(`) or the collection wiring (`, fn)`).
    const uses = (source: string, fn: string) =>
      new RegExp(`\\b${fn}\\s*\\(|,\\s*${fn}\\s*\\)`).test(strip(source))

    const uncalled: string[] = []
    for (const [table, { fn, consumer }] of Object.entries(WRITERS)) {
      if (!uses(await read(consumer), fn))
        uncalled.push(`${table} -> ${consumer} never calls ${fn}`)
    }

    expect([...undeclared, ...uncalled]).toEqual([])
  })

  /**
   * The two containers, asserted structurally.
   *
   * ADR-030 §2 allows `gameId` set (in a Game) or null (on a shelf), and
   * ADR-034 decision 2 extends that to every entity-shaped table — which is
   * what let a crawler survive a deleted Game and, in this change, an
   * encounter NPC too. A table that can only be in a Game cannot express the
   * shelf half, and that is precisely the gap both of those had. A mech
   * pattern is personal, so it is shelf-only and not one of them.
   */
  test('every entity-shaped table can express BOTH containers', () => {
    const ENTITY_TABLES = ['pilots', 'mechs', 'crawlers', 'encounterNpcs'] as const

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
