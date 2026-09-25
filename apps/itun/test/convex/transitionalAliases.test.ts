import { describe, expect, test } from 'bun:test'
import { makeFunctionReference } from 'convex/server'
import { testConvex } from './harness'

/**
 * The old `entities:*` paths still answer after the AP-07 split.
 *
 * `claimLocal`, `repairContainers`, the pattern / NPC mirror and
 * `appendChangeLog` moved to `claim.ts`, `shelf.ts` and `changeLog.ts`. A tab
 * running the bundle from before the move — ITUN's service worker waits for
 * the user to accept an update — still calls them by their old module name, so
 * `entities.ts` re-exports them for one release ("Transitional aliases" there).
 *
 * Addressed by STRING, exactly as that stale bundle addresses them, rather than
 * through `api.entities.*`: the point is that the deployed path resolves, not
 * that the generated types happen to include it.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(
    async (ctx) => await ctx.db.insert('users', { name, displayName: name })
  )
  return { userId, as: t.withIdentity({ subject: userId }) }
}

const pattern = {
  id: 'pat1',
  schemaVersion: 1,
  name: 'Mule loadout',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('AP-07 transitional aliases', () => {
  test('entities:upsertMechPattern / removeMechPattern still mirror a pattern', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(makeFunctionReference<'mutation'>('entities:upsertMechPattern'), {
      body: pattern,
    })
    expect(await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())).toHaveLength(1)

    await u.as.mutation(makeFunctionReference<'mutation'>('entities:removeMechPattern'), {
      patternId: 'pat1',
    })
    expect(await t.run(async (ctx) => await ctx.db.query('mechPatterns').collect())).toEqual([])
  })

  test('entities:claimLocal still claims, and entities:repairContainers still runs', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    const claimed = await u.as.mutation(makeFunctionReference<'mutation'>('entities:claimLocal'), {
      pilots: [],
      mechs: [],
      mechPatterns: [pattern],
    })
    expect(claimed).toMatchObject({ claimed: 1, skipped: 0 })

    const repaired = await u.as.mutation(
      makeFunctionReference<'mutation'>('entities:repairContainers'),
      {}
    )
    expect(repaired).toMatchObject({ repaired: 0, skipped: 0 })
  })

  test('entities:appendChangeLog still appends', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(makeFunctionReference<'mutation'>('entities:appendChangeLog'), {
      entries: [
        {
          gameId: null,
          entityType: 'pilot',
          entityId: 'p1',
          ts: 1,
          kind: 'manual',
          field: 'name',
          before: 'a',
          after: 'b',
          source: 'test',
        },
      ],
    })
    expect(await t.run(async (ctx) => await ctx.db.query('changeLog').collect())).toHaveLength(1)
  })

  test('entities:upsertEncounterNpc / removeEncounterNpc still mirror the tray', async () => {
    const t = testConvex()
    const u = await makeUser(t, 'A')

    await u.as.mutation(makeFunctionReference<'mutation'>('entities:upsertEncounterNpc'), {
      body: { id: 'npc1', name: 'Scav' },
    })
    expect(await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())).toHaveLength(
      1
    )
    await u.as.mutation(makeFunctionReference<'mutation'>('entities:removeEncounterNpc'), {
      npcId: 'npc1',
    })
    expect(await t.run(async (ctx) => await ctx.db.query('encounterNpcs').collect())).toEqual([])
  })
})
