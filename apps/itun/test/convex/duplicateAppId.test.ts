import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { testConvex } from './harness'

/**
 * Surviving duplicate `appId` rows that already exist.
 *
 * This is the **second** half of the duplicate-appId story, and deliberately
 * not the first. Preventing new duplicates (`claimLocal` + `appIdTaken`) and
 * repairing old ones (`maintenance.dedupeAppIds`) are covered by
 * `entities.test.ts` and `maintenance.test.ts`. What is pinned here is what
 * happens to a player whose roster is duplicated *right now*, before anyone has
 * run the repair.
 *
 * That case mattered enough to earn its own answer. `byAppId` asked for
 * `.unique()` on `by_app_id` — an ordinary Convex index, not a uniqueness
 * constraint — so it threw; and because mirrored writes are fire-and-forget,
 * `mirrorWrite` swallowed the throw. The local copy went on accepting edits,
 * every surface went on rendering them as saved, and nothing reached the game
 * for the better part of an hour. Production held four `Babe`s and four
 * `Reaper`s, and the feedback was "the game mechs didn't save".
 *
 * So a duplicate is treated as a repair job rather than a reason to refuse the
 * write that would have kept client and server in step: the lookup resolves to
 * the oldest row and logs, the write lands, and `maintenance.dedupeAppIds`
 * clears up afterwards. Prevention closes the front door; this makes the
 * failure survivable if anything ever opens it again.
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
    name: 'Babe',
    callsign: 'Babe',
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

describe('byAppId tolerates duplicate rows', () => {
  test('an edit still lands when two rows share an appId', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    // Exactly what a second claim produced: two rows, same appId, same owner.
    await t.run(async (ctx) => {
      for (const _ of [0, 1]) {
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: u.userId,
          appId: 'dupe-1',
          body: pilotBody(),
          updatedAt: Date.now(),
        })
      }
    })

    // Before this, `unique() query returned more than one result` — swallowed.
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'dupe-1',
      gameId: null,
      body: pilotBody({ name: 'Babe Renamed' }),
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    const names = rows.map((r) => (r.body as { name: string }).name)

    // The write landed on exactly one row and did not fan out across the
    // duplicates or create a third.
    expect(rows).toHaveLength(2)
    expect(names).toContain('Babe Renamed')
    expect(names.filter((n) => n === 'Babe Renamed')).toHaveLength(1)
  })

  test('the oldest row wins, so the winner does not move between calls', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    const [first] = await t.run(async (ctx) => {
      const a = await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: u.userId,
        appId: 'dupe-2',
        body: pilotBody({ name: 'Oldest' }),
        updatedAt: Date.now(),
      })
      const b = await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: u.userId,
        appId: 'dupe-2',
        body: pilotBody({ name: 'Newer' }),
        updatedAt: Date.now(),
      })
      return [a, b]
    })

    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'dupe-2',
      gameId: null,
      body: pilotBody({ name: 'Written' }),
    })

    // Deterministic, and the SAME row `maintenance.dedupeAppIds` keeps — so a
    // write that lands before the repair runs is not thrown away by it.
    const oldest = await t.run(async (ctx) => await ctx.db.get(first))
    expect(oldest).not.toBeNull()
    expect((oldest?.body as { name: string } | undefined)?.name).toBe('Written')
  })

  test('a delete addressed by appId still finds its row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await t.run(async (ctx) => {
      for (const _ of [0, 1]) {
        await ctx.db.insert('pilots', {
          gameId: null,
          ownerId: u.userId,
          appId: 'dupe-3',
          body: pilotBody(),
          updatedAt: Date.now(),
        })
      }
    })

    await u.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'dupe-3' })

    // One removed — not zero, which is what a throw produced.
    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
  })
})
