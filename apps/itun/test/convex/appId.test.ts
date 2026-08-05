import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
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

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

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
    })
    await u.as.mutation(api.entities.upsertByAppId, {
      table: 'pilots',
      appId: 'local-uuid-1',
      gameId: null,
      body: pilotBody({ name: 'Renamed' }),
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
    })

    // Addressing by a client-supplied id must not become a way to write
    // somebody else's data by guessing theirs.
    await expect(
      other.as.mutation(api.entities.upsertByAppId, {
        table: 'pilots',
        appId: 'local-uuid-1',
        gameId: null,
        body: pilotBody({ name: 'Hijacked' }),
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
    })

    await expect(
      other.as.mutation(api.entities.removeByAppId, { table: 'pilots', appId: 'local-uuid-1' })
    ).rejects.toThrow(/another player/i)
  })
})
