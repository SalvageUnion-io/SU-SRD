import { describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

/**
 * Repairing rows that were duplicated before `claimLocal` stopped duplicating.
 *
 * `claimLocal` no longer inserts a second row for an app id it already holds,
 * which closes the hole — but every account claimed twice before that fix still
 * carries the damage, and the damage is not self-healing. `byAppId` and
 * `patchCrawlerByAppId` call `.unique()`, so a duplicated app id makes **every
 * mirrored write for that entity throw, forever**. The mirror is
 * fire-and-forget, so the player sees nothing at all: local writes keep
 * succeeding while the server of record silently stops receiving them.
 *
 * The first case below pins that mechanism rather than assuming it — a repair
 * whose premise is untested is a repair nobody can trust.
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

/**
 * Write the damage directly.
 *
 * `claimLocal` cannot produce this any more, which is the point of the fix — so
 * reproducing a pre-fix account means inserting the second row by hand, exactly
 * as the old unconditional insert did.
 */
async function duplicatePilot(t: Ctx, ownerId: Id<'users'>, appId: string, count: number) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i += 1) {
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId,
        appId,
        body: pilotBody({ id: appId, name: `copy ${i}` }),
        updatedAt: 1_000 + i,
      })
    }
  })
}

describe('duplicate app ids break the mirror', () => {
  test('a second row with the same app id makes every upsert throw', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await duplicatePilot(t, u.userId, 'p1', 2)

    // This is the production failure, reproduced: an opaque server error on
    // every edit, from a mutation that swallows it.
    await expect(
      u.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'p1',
        gameId: null,
        body: pilotBody(),
      })
    ).rejects.toThrow(/unique/i)
  })
})

describe('dedupeAppIds', () => {
  test('the dry run reports what it would do and changes nothing', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await duplicatePilot(t, u.userId, 'p1', 3)

    const report = await t.mutation(internal.maintenance.dedupeAppIds, {})

    expect(report.applied).toBe(false)
    expect(report.duplicatedAppIds).toBe(1)
    expect(report.groups[0]?.rows).toBe(3)
    expect(report.groups[0]?.deleted).toHaveLength(2)
    // A report that pre-counted its own hypothetical deletions would read
    // exactly like one that had already made them.
    expect(report.rowsDeleted).toBe(0)

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(3)
  })

  test('applying it leaves one row and the mirror works again', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await duplicatePilot(t, u.userId, 'p1', 3)

    const report = await t.mutation(internal.maintenance.dedupeAppIds, { apply: true })
    expect(report.applied).toBe(true)
    expect(report.rowsDeleted).toBe(2)

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)

    // The whole point: the entity is writable again.
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'p1',
      gameId: null,
      body: pilotBody({ name: 'Writable again' }),
    })
    const after = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect((after[0]?.body as { name: string } | undefined)?.name).toBe('Writable again')
  })

  test('an owned row outlives an unclaimed one', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await t.run(async (ctx) => {
      // The unclaimed row is written LAST and with the newer timestamp, so only
      // the ownership rule can save the right one here.
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: u.userId,
        appId: 'p1',
        body: pilotBody({ name: 'somebody’s character' }),
        updatedAt: 1,
      })
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: null,
        appId: 'p1',
        body: pilotBody({ name: 'an offer nobody took' }),
        updatedAt: 999,
      })
    })

    await t.mutation(internal.maintenance.dedupeAppIds, { apply: true })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('somebody’s character')
  })

  test('change-log rows left pointing at a deleted copy are counted, not hidden', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await duplicatePilot(t, u.userId, 'p1', 2)

    const doomed = await t.run(async (ctx) => {
      const rows = await ctx.db.query('pilots').collect()
      // Whichever row loses is decided by the same rule the repair uses: equal
      // ownership, so the newer `updatedAt` survives and the older is deleted.
      const loser = rows.find((r) => r.updatedAt === 1_000)
      await ctx.db.insert('changeLog', {
        gameId: null,
        entityType: 'pilot',
        entityId: loser?._id ?? '',
        ts: Date.now(),
        kind: 'manual',
        field: 'name',
        before: 'a',
        after: 'b',
        source: 'live-sheet',
        actorId: u.userId,
        state: 'applied',
      })
      return loser?._id
    })

    expect(doomed).toBeDefined()
    const report = await t.mutation(internal.maintenance.dedupeAppIds, {})
    // Proposals and history address an entity by Convex id, not app id, so a
    // repair that says nothing about them would be quietly detaching history.
    expect(report.orphanedChangeLogRows).toBe(1)
  })

  test('a clean deployment reports nothing to do', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await u.as.mutation(api.entities.claimLocal, { pilots: [pilotBody()], mechs: [] })

    const report = await t.mutation(internal.maintenance.dedupeAppIds, {})
    expect(report.duplicatedAppIds).toBe(0)
    expect(report.groups).toEqual([])
    expect(report.scanned).toBe(1)
  })
})
