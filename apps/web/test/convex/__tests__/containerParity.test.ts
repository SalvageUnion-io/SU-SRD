/**
 * The standing gate for ADR-034 decision 2: **every kind of record a store
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
 * a Convex table that could receive it, and a client commit path that actually
 * writes to it (the store → commit-path table is in
 * `docs/ARCHITECTURE.md#convex`). The first catches the cheaper and more
 * common mistake: adding store number nine and forgetting the server entirely.
 *
 * ## Reading a failure
 *
 * If this fails you have added a local record kind with no server counterpart.
 * The fix is a Convex table. There is no exemption list.
 */

import { describe, expect, test } from 'bun:test'
import schema from '../../../convex/schema'
import { RECORD_KINDS } from '../../../src/cantina/stores/records'

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

describe('container parity — every local store can reach the server', () => {
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
  test('every Convex-backed store has a client commit path, not just a table', async () => {
    const backend = await Bun.file(
      new URL('../../../src/cantina/stores/entityBackend.ts', import.meta.url)
    ).text()

    // store name → the commit function, and the store module that must CALL it.
    //
    // The consumer half is the point. This test asserted only that
    // `entityBackend.ts` DECLARED each function, which is a weaker claim than
    // it reads as: `commitPatternWrite` and `commitNpcWrite` have exactly one
    // call site each, so deleting `commit: commitPatternWrite` from
    // `patternStore.ts` stops patterns reaching Convex while leaving the
    // declaration — and this test — untouched. That is the same shape as the
    // table-only gap this test replaced: "the name exists somewhere" standing
    // in for "the data arrives".
    const WRITERS: Record<string, { fn: string; consumer: string }> = {
      pilots: { fn: 'commitEntityWrite', consumer: 'entityStore.ts' },
      mechs: { fn: 'commitEntityWrite', consumer: 'entityStore.ts' },
      crawlers: { fn: 'commitEntityWrite', consumer: 'entityStore.ts' },
      npcs: { fn: 'commitEntityWrite', consumer: 'entityStore.ts' },
      softLinks: { fn: 'commitSoftLink', consumer: 'entityStore.ts' },
      mechPatterns: { fn: 'commitPatternWrite', consumer: 'patternStore.ts' },
      encounterNpcs: { fn: 'commitNpcWrite', consumer: 'encounterStore.ts' },
      changeLog: { fn: 'commitChangeLog', consumer: 'entityChangeLog.ts' },
    }

    const undeclared = Object.entries(WRITERS)
      .filter(([, { fn }]) => !backend.includes(`export async function ${fn}(`))
      .map(([store, { fn }]) => `${store} -> ${fn} is not declared in entityBackend.ts`)

    const sources = new Map<string, string>()
    for (const { consumer } of Object.values(WRITERS)) {
      if (sources.has(consumer)) continue
      sources.set(
        consumer,
        await Bun.file(new URL(`../../../src/cantina/stores/${consumer}`, import.meta.url)).text()
      )
    }

    /**
     * Strip everything that can carry the name without using it.
     *
     * This started as a per-LINE filter that skipped lines beginning `import`,
     * `//`, `*` or `/*`, and it was vacuous for five of the seven stores.
     * Biome formats a multi-name import one name per line, so
     * `entityStore.ts`'s import block contributes lines that read exactly
     * `  commitEntityWrite,` — which begins with none of those prefixes and was
     * therefore counted as a use. Deleting all ten real call sites in
     * `entityStore.ts` left `pilots`, `mechs`, `crawlers`, `softLinks` and
     * `changeLog` passing on the strength of the import block alone.
     *
     * That is the same "the name exists somewhere" substitution this test was
     * written to remove, one level down: table → declaration → mention.
     *
     * So the scan is now source-level rather than line-level. Comments go
     * first (a trailing `// was commitPatternWrite` on a disabled line is what
     * switching a commit off actually looks like), then import and re-export
     * statements, which name a function without invoking it.
     */
    const strip = (source: string) =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/\bimport\s+(?:type\s+)?[\s\S]*?\bfrom\s*['"][^'"]*['"]/g, ' ')
        .replace(/\bexport\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"]/g, ' ')

    /**
     * A use is a CALL or a wiring, not a mention.
     *
     * `fn(` covers the direct calls in `entityStore.ts`; `commit: fn` covers
     * the slice wiring in `patternStore.ts` and `encounterStore.ts`, which is
     * the single line whose removal silently stops those commits.
     *
     * Known residual, stated rather than papered over: a call inside dead code
     * (`if (false) await commitPatternWrite(op)`) still reads as a use.
     * Distinguishing that needs reachability analysis, not a regex, and it is
     * a much less likely edit than the two this now catches.
     */
    const uses = (source: string, fn: string) =>
      new RegExp(`\\b${fn}\\s*\\(|commit:\\s*${fn}\\b`).test(strip(source))

    const uncalled = Object.entries(WRITERS)
      .filter(([, { fn, consumer }]) => !uses(sources.get(consumer) ?? '', fn))
      .map(([store, { fn, consumer }]) => `${store} -> ${consumer} never calls ${fn}`)

    expect([...undeclared, ...uncalled]).toEqual([])
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
      'npcs',
      'softLinks',
      'mechPatterns',
      'encounterNpcs',
      'changeLog',
    ])
    const unmapped = KIND_NAMES.filter((name) => tables.has(name) && !mapped.has(name))

    expect(unmapped).toEqual([])
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
