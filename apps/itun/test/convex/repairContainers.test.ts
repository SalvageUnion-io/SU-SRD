/**
 * `maintenance.repairContainers` — rows whose body disagrees with their column
 * (ADR-035).
 *
 * A build claimed before accounts can carry a body that names a Workspace id as
 * its `gameId` — never a Game — while its column says shelf. Signed in,
 * `Roster` scopes to the active container and such a build is gone.
 *
 * The rule under test is `body.gameId := row.gameId` — the column is the
 * authority, because it is what the server enforces container and ownership
 * against. These pin that it repairs toward the column in BOTH directions, and
 * that it never moves an entity somewhere it was not already filed. It runs
 * across every account, a page at a time.
 */

import { describe, expect, test } from 'bun:test'
import { internal } from '../../convex/_generated/api'
import { makeUser } from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * The `gameId` inside a row's body.
 *
 * A helper rather than an inline cast because every assertion here is about
 * that one field, and `(row?.body as ...).gameId` is an unsafe optional chain —
 * it would throw a TypeError rather than fail an assertion if the row were
 * missing, which turns a real regression into a confusing stack trace.
 */
function gameIdOf(row: { body: unknown } | null): unknown {
  const body = row?.body as { gameId?: unknown } | undefined
  return body?.gameId
}

/**
 * A minimal body that satisfies PilotSchema.
 *
 * It has to genuinely parse: the repair re-parses before it patches, so a
 * fixture that did not would take the `skipped` path and the test would pass
 * for the wrong reason.
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

describe('a claimed build whose body names a Game that does not exist', () => {
  test('is repaired onto the shelf, so a connected Roster can see it again', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: me.userId,
          appId: 'p1',
          // The column says shelf, the body says a Workspace id stored as a
          // `gameId`.
          body: pilotBody({ gameId: 'ws-abc' }),
          updatedAt: 1,
        })
    )

    const result = await t.action(internal.maintenance.repairContainers, {})
    expect(result.repaired).toBe(1)

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    expect(gameIdOf(row)).toBeNull()
  })

  test('a pre-split body with no gameId at all is repaired too', async () => {
    // `containerOf` falls back to `workspaceId` when `gameId` is absent, so this
    // record reads as being in a phantom Game exactly like the one above. A raw
    // `body.gameId ?? null` comparison would call it identical to a shelf row
    // and skip it — which is why the check goes through `containerOf`.
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('mechs', {
          gameId: null,
          ownerId: me.userId,
          body: mechBody({ workspaceId: 'ws-abc' }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(1)

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    expect(gameIdOf(row)).toBeNull()
  })

  test('a shelf crawler is repaired on the same rule', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId: null,
          ownerId: me.userId,
          body: crawlerBody({ gameId: 'ws-abc' }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(1)

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    expect(gameIdOf(row)).toBeNull()
  })
})

describe('what it must not touch', () => {
  test('a row already in agreement is left alone, so a second run is a no-op', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: me.userId,
          body: pilotBody({ gameId: null }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(0)
  })

  test('running it twice repairs once — it converges rather than churning', async () => {
    // A re-run must be safe: the workflow that runs it can be dispatched again,
    // or retried after a partial failure.
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: me.userId,
          body: pilotBody({ gameId: 'ws-abc' }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(1)
    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(0)
  })

  test('a build genuinely IN a Game keeps that Game', async () => {
    // The repair is toward the COLUMN, not toward the shelf. "Shelve anything
    // whose Game I am not a member of" would be a different rule and a
    // destructive one — it would move a live campaign build onto the shelf.
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId,
          ownerId: me.userId,
          body: pilotBody({ gameId: null }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(1)

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    expect(gameIdOf(row)).toBe(gameId)
  })

  test('every account is repaired, across pages', async () => {
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    const them = await makeUser(t, 'Them')
    const ids = await t.run(async (ctx) => {
      const out = []
      for (const [owner, id] of [
        [me.userId, 'p1'],
        [them.userId, 'p2'],
        [them.userId, 'p3'],
      ] as const) {
        out.push(
          await ctx.db.insert('pilots', {
            gameId: null,
            ownerId: owner,
            body: pilotBody({ id, gameId: 'ws-abc' }),
            updatedAt: 1,
          })
        )
      }
      return out
    })

    const result = await t.action(internal.maintenance.repairContainers, { pageSize: 1 })
    expect(result.repaired).toBe(3)
    expect(result.byKind).toEqual({ pilots: 3 })

    const rows = await t.run(async (ctx) => await Promise.all(ids.map((id) => ctx.db.get(id))))
    expect(rows.map(gameIdOf)).toEqual([null, null, null])
  })

  test('a communal crawler is left alone — it has no owner', async () => {
    // A crawler inside a Game carries `ownerId: null` (D8): its body is the
    // crew's rather than any one player's, so the repair does not write it.
    const t = testConvex()
    const gameId = await t.run(async (ctx) => await ctx.db.insert('games', { name: 'Table' }))
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('crawlers', {
          gameId,
          ownerId: null,
          body: crawlerBody({ gameId: 'ws-abc' }),
          updatedAt: 1,
        })
    )

    expect((await t.action(internal.maintenance.repairContainers, {})).repaired).toBe(0)

    const row = await t.run(async (ctx) => await ctx.db.get(id))
    expect(gameIdOf(row)).toBe('ws-abc')
  })

  test('a body this build cannot re-parse is counted and left exactly as it is', async () => {
    // Still readable, still owned, still exportable. Refusing to rewrite it is
    // strictly safer than writing a shape the schema rejects, and the count
    // comes back so the caller can say so rather than reporting a clean run.
    const t = testConvex()
    const me = await makeUser(t, 'Me')
    await t.run(
      async (ctx) =>
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: me.userId,
          body: pilotBody({ gameId: 'ws-abc', callsign: 42 }),
          updatedAt: 1,
        })
    )

    const result = await t.action(internal.maintenance.repairContainers, {})
    expect(result.repaired).toBe(0)
    expect(result.skipped).toBe(1)
  })
})
