import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { staleWriteOf } from '../../src/lib/connection/staleWrite'
import { makeUser } from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * Addressing server rows by the client's own app id.
 *
 * This exists because the first write-mirroring attempt could not work at all:
 * Convex mints its own `_id`, so a client holding only its local UUID had
 * nothing to address a row by. Creates mirrored and edits silently no-opped —
 * a mirror that looked synced and was not.
 *
 * The cases below pin the two properties that fix it: **an edit finds its row**,
 * and **a missing row is created rather than dropped**, which is what makes the
 * mirror converge for entities built while Solo and claimed afterwards.
 */

function pilotBody(over: Record<string, unknown> = {}) {
  return {
    id: 'local-uuid-1',
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

describe('upsertByAppId', () => {
  test('creates when no row carries that app id', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    // The Solo-then-claim path: the entity exists locally long before the
    // server has ever heard of it.
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.appId).toBe('local-uuid-1')
  })

  test('a second write updates rather than duplicating', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody({ name: 'Renamed' }),
      expectedUpdatedAt: null,
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    // The bug this replaces: an edit that could not find its row. One row, new
    // name — not two rows, and not a silent no-op.
    expect(rows).toHaveLength(1)
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('Renamed')
  })

  test("cannot overwrite another player's row that happens to share an app id", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const other = await makeUser(t, 'Other')

    await owner.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })

    // Addressing by a client-supplied id must not become a way to write
    // somebody else's data by guessing theirs.
    await expect(
      other.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'local-uuid-1',
        gameId: null,
        body: pilotBody({ name: 'Hijacked' }),
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/another player/i)
  })

  test('a malformed body is still rejected', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await expect(
      u.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'local-uuid-1',
        gameId: null,
        body: { nonsense: true },
        expectedUpdatedAt: null,
      })
    ).rejects.toThrow(/invalid pilots payload/i)
  })
})

describe('removeByAppId', () => {
  test('deletes the addressed row', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })

    await u.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'local-uuid-1' })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(0)
  })

  test('a row that is already gone is not an error', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    // The mirror is fire-and-forget and may retry or arrive out of order; a
    // delete of something already deleted must be a no-op, not a throw.
    await u.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'never-existed' })
  })

  test("cannot delete another player's row", async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const other = await makeUser(t, 'Other')
    await owner.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })

    await expect(
      other.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'local-uuid-1' })
    ).rejects.toThrow(/another player/i)
  })
})

describe('upsertByAppId refuses a write from a stale copy', () => {
  afterEach(() => {
    setSystemTime()
  })

  test('the second of two writers, working from an older version, overwrites nothing', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    setSystemTime(new Date(1_000))
    const first = await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })
    expect(first.updatedAt).toBe(1_000)

    // Two devices of the same player both hold version 1000. The laptop saves.
    setSystemTime(new Date(2_000))
    const laptop = await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody({ name: 'From the laptop' }),
      expectedUpdatedAt: first.updatedAt,
    })
    expect(laptop.updatedAt).toBe(2_000)

    // The phone saves a whole body built from version 1000: refused, with the
    // row the server holds so the phone can show it.
    setSystemTime(new Date(3_000))
    let refusal: unknown = null
    try {
      await u.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'local-uuid-1',
        gameId: null,
        body: pilotBody({ name: 'From the phone' }),
        expectedUpdatedAt: first.updatedAt,
      })
    } catch (err) {
      refusal = err
    }
    const stale = staleWriteOf(refusal)
    expect(stale?.updatedAt).toBe(2_000)
    expect((stale?.body as { name?: string } | undefined)?.name).toBe('From the laptop')

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect(rows).toHaveLength(1)
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('From the laptop')
    expect(rows[0]?.updatedAt).toBe(2_000)
  })

  test('a write made against the current version lands', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')
    setSystemTime(new Date(1_000))
    const first = await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody(),
      expectedUpdatedAt: null,
    })

    setSystemTime(new Date(2_000))
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody({ name: 'Renamed' }),
      expectedUpdatedAt: first.updatedAt,
    })

    const rows = await t.run(async (ctx) => await ctx.db.query('pilots').collect())
    expect((rows[0]?.body as { name: string } | undefined)?.name).toBe('Renamed')
  })
})
