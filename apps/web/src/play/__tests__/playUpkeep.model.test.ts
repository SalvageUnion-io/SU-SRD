/**
 * Paying a Downtime's Upkeep from Play (`playUpkeep.model.ts`): the claim
 * first, then the Scrap, and words that say only what landed.
 */
import { describe, expect, spyOn, test } from 'bun:test'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { payDowntimeUpkeep } from '../playUpkeep.model'

const crawler = crawlerFixture({
  id: 'c',
  name: 'Tenacity',
  techLevel: 'tech-2',
  scrapPool: { tl2: 7 },
  upgradePool: 0,
})

function store(update: (patch: Partial<Crawler>) => Promise<void>) {
  return {
    get: () => crawler,
    update: (_kind: string, _id: string, patch: Partial<Crawler>) => update(patch),
  } as never
}

describe('payDowntimeUpkeep', () => {
  test('draws the Scrap once the claim is this call’s', async () => {
    const written: Partial<Crawler>[] = []
    const said = await payDowntimeUpkeep({
      crawler,
      store: store(async (patch) => {
        written.push(patch)
      }),
      spendUpkeep: async () => true,
    })
    expect(written).toEqual([{ scrapPool: { tl2: 2 }, upgradePool: 5 }])
    expect(said).toBe('Paid the Upkeep. Upgrade Pool now 5.')
  })

  test('a refused Scrap write never reads as paid', async () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => undefined)
    const said = await payDowntimeUpkeep({
      crawler,
      store: store(async () => {
        throw new Error('refused')
      }),
      spendUpkeep: async () => true,
    })
    quiet.mockRestore()
    expect(said).toContain('the 5 Scrap was not drawn')
  })

  test('an Upkeep already claimed draws nothing', async () => {
    const written: Partial<Crawler>[] = []
    const said = await payDowntimeUpkeep({
      crawler,
      store: store(async (patch) => {
        written.push(patch)
      }),
      spendUpkeep: async () => false,
    })
    expect(written).toEqual([])
    expect(said).toBe('Upkeep is already paid this Downtime.')
  })
})
