import { describe, expect, test } from 'bun:test'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import { api } from '../../../convex/_generated/api'
import { STALE_WRITE_REFUSAL } from '../../../convex/model/staleWrite'
import type { Ctx } from '../fixtures'
import {
  addCrawler,
  addMech,
  addPilot,
  allLinks,
  link,
  mechBody,
  ref,
  seedTable,
  unitOp,
} from '../fixtures'
import { testConvex } from '../harness'

/**
 * `ops.transfer` — a cross-entity value move as ONE mutation.
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
  await user.as.mutation(api.entities.upsertByAppId, {
    table: 'mechs',
    appId: 'm1',
    gameId,
    body: { ...mechBody({ id: 'm1', gameId }), cargoLots: [CRATE] },
    expectedUpdatedAt: null,
  })
  /** The stow, mech first: the order a split refusal would lose the lot in. */
  const stow = {
    ops: [
      unitOp('mech', { appId: 'm1', gameId, patch: { cargoLots: [] }, baseSeq: 0 }),
      unitOp('crawler', { appId: 'c1', gameId, patch: { cargoLots: [CRATE] } }),
    ],
    deletes: [],
  }
  return { t, ...table, user, stow }
}

describe('ops.transfer', () => {
  test("a player's stow refused on the crawler leaves the mech as it was", async () => {
    const { t, user, stow } = await seedHold('player')

    await expect(user.as.mutation(api.ops.transfer, stow)).rejects.toThrow()

    expect(await holds(t)).toEqual({ mech: ['Crate'], bay: [] })
  })

  test('the table runner stows the same lot, and both rows move', async () => {
    const { t, user, stow } = await seedHold('organizer')

    const { applied } = await user.as.mutation(api.ops.transfer, stow)

    expect(await holds(t)).toEqual({ mech: [], bay: ['Crate'] })
    // Each unit's new seq, for the client's next op against it.
    expect(applied.map((a) => [a.unitId, a.headSeq])).toEqual([
      ['m1', 1],
      ['c1', 1],
    ])
  })

  test('a conflicting mech op refuses the whole transfer, the crawler half included', async () => {
    const { t, user, stow } = await seedHold('organizer')
    const [mechOp, crawlerOp] = stow.ops
    if (mechOp === undefined || crawlerOp === undefined) throw new Error('no stow')
    // Another device wrote the mech's cargo since this copy was made.
    await user.as.mutation(
      api.ops.apply,
      unitOp('mech', { appId: 'm1', patch: { cargoLots: [CRATE] } })
    )

    await expect(
      // Crawler first this time, so it would have landed before the refusal.
      user.as.mutation(api.ops.transfer, { ops: [crawlerOp, mechOp], deletes: [] })
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

    await organizer.as.mutation(api.ops.transfer, {
      ops: [unitOp('crawler', { appId: 'c1', patch: { scrapPool: { tl1: 3 } } })],
      deletes: [{ table: 'mechs', appId: 'm1' }],
    })

    const mechs = await t.run(async (ctx) => await ctx.db.query('mechs').collect())
    expect(mechs).toHaveLength(0)
    expect((await allLinks(t)).filter((l) => l.from === 'm1' || l.to === 'm1')).toEqual([])
  })

  test("a refused delete rolls back the transfer's ops", async () => {
    const { t, organizer, player, gameId } = await seedHold('player')
    await addMech(organizer, 'm2', gameId)

    await expect(
      player.as.mutation(api.ops.transfer, {
        ops: [unitOp('mech', { appId: 'm1', gameId, patch: { cargoLots: [] } })],
        // The Organizer's mech: not the player's to scrap.
        deletes: [{ table: 'mechs', appId: 'm2' }],
      })
    ).rejects.toThrow()

    expect((await holds(t)).mech).toEqual(['Crate'])
  })
})
