import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { STALE_WRITE_REFUSAL } from '../../src/lib/connection/staleWrite'
import { makeUnitLot } from '../../src/lib/schemas/cargoLot'
import type { Ctx } from './fixtures'
import { addCrawler, addMech, addPilot, allLinks, link, mechBody, ref, seedTable } from './fixtures'
import { testConvex } from './harness'

/**
 * `entities.transfer` — a cross-entity value move as ONE mutation.
 *
 * A stow or a load writes a mech and a crawler. In a Game only the table runner
 * writes the crawler (ADR-038 §5), so a player's stow is refused on the crawler
 * side; as two mutations, the mech half could land first and the lot was lost
 * (or, on a load, duplicated). One mutation is one transaction: a refusal on
 * any record leaves every row as it was, whatever order the records come in.
 */

const CRATE = makeUnitLot('Crate')

/** The cargo on the server's mech and crawler rows, by lot name. */
async function holds(t: Ctx) {
  const rows = await t.run(async (ctx) => ({
    mechs: await ctx.db.query('mechs').collect(),
    crawlers: await ctx.db.query('crawlers').collect(),
  }))
  const names = (body: unknown) =>
    ((body as { cargoLots?: { name: string }[] }).cargoLots ?? []).map((lot) => lot.name)
  return {
    mech: names(rows.mechs.find((r) => r.appId === 'm1')?.body),
    bay: names(rows.crawlers.find((r) => r.appId === 'c1')?.body),
  }
}

/** A Game with crawler `c1` and `holder`'s mech `m1` carrying a crate. */
async function seedHold(holder: 'organizer' | 'player') {
  const t = testConvex()
  const table = await seedTable(t)
  const { gameId } = table
  await addCrawler(table.organizer, 'c1', gameId)
  const user = table[holder]
  const { updatedAt } = await user.as.mutation(api.entities.upsertByAppId, {
    table: 'mechs',
    appId: 'm1',
    gameId,
    body: { ...mechBody({ id: 'm1', gameId }), cargoLots: [CRATE] },
    expectedUpdatedAt: null,
  })
  /** The stow, mech first: the order the refusal used to split. */
  const stow = {
    updates: [
      {
        table: 'mechs' as const,
        appId: 'm1',
        gameId,
        body: { ...mechBody({ id: 'm1', gameId }), cargoLots: [] },
        expectedUpdatedAt: updatedAt,
      },
      { table: 'crawlers' as const, appId: 'c1', patch: { cargoLots: [CRATE] } },
    ],
    deletes: [],
  }
  return { t, ...table, user, stow, updatedAt }
}

describe('entities.transfer', () => {
  test("a player's stow refused on the crawler leaves the mech as it was", async () => {
    const { t, user, stow } = await seedHold('player')

    await expect(user.as.mutation(api.entities.transfer, stow)).rejects.toThrow()

    expect(await holds(t)).toEqual({ mech: ['Crate'], bay: [] })
  })

  test('the table runner stows the same lot, and both rows move', async () => {
    const { t, user, stow, updatedAt } = await seedHold('organizer')

    const { versions } = await user.as.mutation(api.entities.transfer, stow)

    expect(await holds(t)).toEqual({ mech: [], bay: ['Crate'] })
    // The mech's new version, for the client's next write against it.
    expect(versions).toHaveLength(1)
    expect(versions[0]?.appId).toBe('m1')
    expect(versions[0]?.updatedAt).toBeGreaterThanOrEqual(updatedAt)
  })

  test('a stale mech body refuses the whole transfer, the crawler half included', async () => {
    const { t, user, stow, updatedAt } = await seedHold('organizer')
    const [mechWrite, crawlerPatch] = stow.updates

    await expect(
      user.as.mutation(api.entities.transfer, {
        // Crawler first this time, so it would have landed before the refusal.
        updates: [crawlerPatch, { ...mechWrite, expectedUpdatedAt: updatedAt - 1 }],
        deletes: [],
      } as typeof stow)
    ).rejects.toThrow(STALE_WRITE_REFUSAL)

    expect(await holds(t)).toEqual({ mech: ['Crate'], bay: [] })
  })

  test('a removed mech takes its links with it', async () => {
    const t = testConvex()
    const { organizer, gameId } = await seedTable(t)
    await addCrawler(organizer, 'c1', gameId)
    await addPilot(organizer, 'p1', gameId)
    await addMech(organizer, 'm1', gameId)
    await link(organizer, ref.mech('m1'), ref.pilot('p1'), 'mech-to-pilot')

    await organizer.as.mutation(api.entities.transfer, {
      updates: [{ table: 'crawlers', appId: 'c1', patch: { scrapPool: { tl1: 3 } } }],
      deletes: [{ table: 'mechs', appId: 'm1' }],
    })

    const mechs = await t.run(async (ctx) => await ctx.db.query('mechs').collect())
    expect(mechs).toHaveLength(0)
    expect((await allLinks(t)).filter((l) => l.from === 'm1' || l.to === 'm1')).toEqual([])
  })

  test("a refused delete rolls back the transfer's updates", async () => {
    const { t, organizer, player, gameId } = await seedHold('player')
    await addMech(organizer, 'm2', gameId)

    await expect(
      player.as.mutation(api.entities.transfer, {
        updates: [
          {
            table: 'mechs',
            appId: 'm1',
            gameId,
            body: { ...mechBody({ id: 'm1', gameId }), cargoLots: [] },
            expectedUpdatedAt: null,
          },
        ],
        // The Organizer's mech: not the player's to scrap.
        deletes: [{ table: 'mechs', appId: 'm2' }],
      })
    ).rejects.toThrow()

    expect((await holds(t)).mech).toEqual(['Crate'])
  })
})
