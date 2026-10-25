import { describe, expect, test } from 'bun:test'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Ctx } from '../fixtures'
import { addCrawler, makeUser } from '../fixtures'
import { testConvex } from '../harness'

/**
 * A Game's ledger: factions, deals and jobs. Every member reads it, only the
 * Mediator writes it, and what it pays goes into the crawler exactly once.
 */

type GameId = Id<'games'>

async function seedTable(t: Ctx) {
  const gm = await makeUser(t, 'Mediator')
  const a = await makeUser(t, 'Ash')
  const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
  const code = await gm.as.mutation(api.invites.link, { gameId })
  await a.as.mutation(api.invites.redeem, { code })
  await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })
  return { gm, a, gameId }
}

const stefanus = { id: 'f1', name: 'Stefanus', standing: 'neutral' as const, deal: false }
const vornaya = { id: 'f2', name: 'Vornaya', standing: 'friendly' as const, deal: true }
const drones = { id: 'j1', name: 'Salvage the Drone Parts', factionId: 'f1', pay: 30, payTl: 1 }

/** The crawler's Scrap pool, read straight off its row. */
async function poolOf(t: Ctx, appId: string) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query('crawlers')
      .withIndex('by_app_id', (q) => q.eq('appId', appId))
      .first()
    return (row?.body as { scrapPool?: Record<string, number> } | undefined)?.scrapPool ?? {}
  })
}

/** Begin a Downtime and advance to the Upkeep & Upgrade step. */
async function toUpkeepStep(gm: Awaited<ReturnType<typeof seedTable>>['gm'], gameId: GameId) {
  await gm.as.mutation(api.downtime.begin, { gameId })
  await gm.as.mutation(api.downtime.advance, { gameId })
}

describe('who reads and writes it', () => {
  test('every member reads it, empty before the first write', async () => {
    const t = testConvex()
    const { a, gameId } = await seedTable(t)
    expect(await a.as.query(api.ledger.get, { gameId })).toEqual({
      factions: [],
      jobs: [],
      incomeCollected: false,
    })
  })

  test('somebody outside the Game reads nothing', async () => {
    const t = testConvex()
    const { gameId } = await seedTable(t)
    const stranger = await makeUser(t, 'Stranger')
    expect(await stranger.as.query(api.ledger.get, { gameId })).toBeNull()
  })

  test('only the Mediator writes it', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await expect(
      a.as.mutation(api.ledger.setFaction, { gameId, faction: stefanus })
    ).rejects.toThrow(/mediator/i)
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: stefanus })
    await gm.as.mutation(api.ledger.setJob, { gameId, job: drones })
    const ledger = await a.as.query(api.ledger.get, { gameId })
    expect(ledger?.factions).toEqual([stefanus])
    expect(ledger?.jobs).toEqual([{ ...drones, state: 'open' }])
  })

  test('a blank name is refused', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await expect(
      gm.as.mutation(api.ledger.setFaction, { gameId, faction: { ...stefanus, name: '  ' } })
    ).rejects.toThrow(/ledger/)
  })

  test('it goes with the Game', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: stefanus })
    await gm.as.mutation(api.games.destroy, { gameId })
    const rows = await t.run(async (ctx) => await ctx.db.query('ledgers').collect())
    expect(rows).toEqual([])
  })
})

describe('a finished job pays once', () => {
  test('its pay lands in the crawler at its Tech Level', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await gm.as.mutation(api.ledger.setJob, { gameId, job: { ...drones, payTl: 2 } })

    const paid = await gm.as.mutation(api.ledger.completeJob, { gameId, id: 'j1' })
    expect(paid).toEqual({ scrap: 30, tl: 2, crawlerName: 'Crawler c1' })
    expect((await poolOf(t, 'c1')).tl2).toBe(30)

    // A second press finds it done and pays nothing.
    expect(await gm.as.mutation(api.ledger.completeJob, { gameId, id: 'j1' })).toBeNull()
    expect((await poolOf(t, 'c1')).tl2).toBe(30)
  })

  test('with no crawler to pay into, it stays open', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await gm.as.mutation(api.ledger.setJob, { gameId, job: drones })
    await expect(gm.as.mutation(api.ledger.completeJob, { gameId, id: 'j1' })).rejects.toThrow(
      /no crawler/
    )
    expect((await gm.as.query(api.ledger.get, { gameId }))?.jobs[0]?.state).toBe('open')
  })

  test('a done job cannot be opened again', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await gm.as.mutation(api.ledger.setJob, { gameId, job: drones })
    await gm.as.mutation(api.ledger.completeJob, { gameId, id: 'j1' })
    await expect(
      gm.as.mutation(api.ledger.setJobState, { gameId, id: 'j1', state: 'open' })
    ).rejects.toThrow(/paid/)
  })

  test('a dropped job does not pay', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await gm.as.mutation(api.ledger.setJob, { gameId, job: drones })
    await gm.as.mutation(api.ledger.setJobState, { gameId, id: 'j1', state: 'dropped' })
    expect(await gm.as.mutation(api.ledger.completeJob, { gameId, id: 'j1' })).toBeNull()
    expect((await poolOf(t, 'c1')).tl1).toBeUndefined()
  })
})

describe('deal income is collected once per Downtime', () => {
  test('1 Scrap of the crawler Tech Level per deal, in the Upkeep step', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: { ...stefanus, deal: true } })
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: vornaya })
    await gm.as.mutation(api.downtime.begin, { gameId })

    // Step 1 is Tally Salvage.
    await expect(gm.as.mutation(api.ledger.collectIncome, { gameId })).rejects.toThrow(
      /Upkeep & Upgrade step/
    )
    await gm.as.mutation(api.downtime.advance, { gameId })
    expect(await gm.as.mutation(api.ledger.collectIncome, { gameId })).toEqual({
      scrap: 2,
      tl: 1,
      crawlerName: 'Crawler c1',
    })
    expect(await gm.as.mutation(api.ledger.collectIncome, { gameId })).toBeNull()
    expect((await poolOf(t, 'c1')).tl1).toBe(2)
    expect((await gm.as.query(api.ledger.get, { gameId }))?.incomeCollected).toBe(true)
  })

  test('a fresh Downtime pays again', async () => {
    const t = testConvex()
    const { gm, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: vornaya })
    await toUpkeepStep(gm, gameId)
    await gm.as.mutation(api.ledger.collectIncome, { gameId })
    await gm.as.mutation(api.downtime.end, { gameId })
    expect((await gm.as.query(api.ledger.get, { gameId }))?.incomeCollected).toBe(false)
    await toUpkeepStep(gm, gameId)
    expect((await gm.as.mutation(api.ledger.collectIncome, { gameId }))?.scrap).toBe(1)
    expect((await poolOf(t, 'c1')).tl1).toBe(2)
  })

  test('no deals, nothing to collect; and only the Mediator collects', async () => {
    const t = testConvex()
    const { gm, a, gameId } = await seedTable(t)
    await addCrawler(gm, 'c1', gameId)
    await toUpkeepStep(gm, gameId)
    await expect(gm.as.mutation(api.ledger.collectIncome, { gameId })).rejects.toThrow(/no deals/)
    await gm.as.mutation(api.ledger.setFaction, { gameId, faction: vornaya })
    await expect(a.as.mutation(api.ledger.collectIncome, { gameId })).rejects.toThrow(/mediator/i)
  })
})
