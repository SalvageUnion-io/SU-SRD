/**
 * Paying a Downtime's Upkeep from Play (`playUpkeep.model.ts`): the draw is
 * the run's one Upkeep op, and the words say only what landed.
 */
import { describe, expect, test } from 'bun:test'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { payDowntimeUpkeep, upkeepShort } from '../playUpkeep.model'

const crawler = crawlerFixture({
  id: 'c',
  name: 'Tenacity',
  techLevel: 2,
  scrapPool: { tl2: 7 },
  upgradePool: 0,
})

const store = { get: () => crawler } as never

describe('payDowntimeUpkeep', () => {
  test('sends the Scrap as the Upkeep op on the crawler', async () => {
    const sent: unknown[] = []
    const said = await payDowntimeUpkeep({
      crawler,
      store,
      claim: async (...args) => {
        sent.push(args)
        return true
      },
    })
    expect(sent).toEqual([['upkeep', 'c', { scrapPool: { tl2: 2 }, upgradePool: 5 }]])
    expect(said).toBe('Paid the Upkeep. Upgrade Pool now 5.')
  })

  // r4 A7 (LG4-12): an empty pool was marked Paid.
  test('a pool too small pays nothing, claims nothing, and says by how much with the book’s page', async () => {
    const poor = crawlerFixture({ ...crawler, scrapPool: { tl2: 2 } })
    const sent: unknown[] = []
    const said = await payDowntimeUpkeep({
      crawler: poor,
      store: { get: () => poor } as never,
      claim: async (...args) => {
        sent.push(args)
        return true
      },
    })
    expect(sent).toEqual([])
    expect(said).toBe(
      'Not paid: the pool is 3 short of 5 Scrap of Tech 2 or higher. Unpaid Upkeep: Core Book p.218.'
    )
    expect(upkeepShort(poor)).toBe(3)
    expect(upkeepShort(crawler)).toBe(0)
  })

  test('an Upkeep already paid says so', async () => {
    const said = await payDowntimeUpkeep({ crawler, store, claim: async () => false })
    expect(said).toBe('Upkeep is already paid this Downtime.')
  })

  test('no crawler, nothing to pay', async () => {
    expect(await payDowntimeUpkeep({ crawler: null, store, claim: async () => true })).toBeNull()
  })
})
