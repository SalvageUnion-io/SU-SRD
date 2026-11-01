/**
 * Paying a Downtime's Upkeep from Play (`playUpkeep.model.ts`): the draw is
 * the run's one Upkeep op, and the words say only what landed.
 */
import { describe, expect, test } from 'bun:test'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { payDowntimeUpkeep } from '../playUpkeep.model'

const crawler = crawlerFixture({
  id: 'c',
  name: 'Tenacity',
  techLevel: 'tech-2',
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

  test('a short pool pays what it has, and says by how much', async () => {
    const poor = crawlerFixture({ ...crawler, scrapPool: { tl2: 2 } })
    const said = await payDowntimeUpkeep({
      crawler: poor,
      store: { get: () => poor } as never,
      claim: async () => true,
    })
    expect(said).toContain('3 short of 5 Scrap of Tech 2')
  })

  test('an Upkeep already paid says so', async () => {
    const said = await payDowntimeUpkeep({ crawler, store, claim: async () => false })
    expect(said).toBe('Upkeep is already paid this Downtime.')
  })

  test('no crawler, nothing to pay', async () => {
    expect(await payDowntimeUpkeep({ crawler: null, store, claim: async () => true })).toBeNull()
  })
})
