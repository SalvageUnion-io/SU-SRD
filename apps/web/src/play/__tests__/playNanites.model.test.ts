/**
 * Processing Inert Meld Nanites from Play (`playNanites.model.ts`, False Flag
 * p.66): the write it makes, its words, and that a second press finds nothing.
 */
import { describe, expect, test } from 'bun:test'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { naniteStatus, processDowntimeNanites } from '../playNanites.model'

function memoryStore(initial: Crawler) {
  let current = initial
  return {
    get: (_kind: string, _id: string) => current,
    update: async (_kind: string, _id: string, patch: Partial<Crawler>) => {
      current = { ...current, ...patch }
    },
    read: () => current,
  }
}

const tenacity = (condition: 'intact' | 'damaged' = 'intact') =>
  crawlerFixture({
    id: 'c',
    name: 'Tenacity',
    techLevel: 'tech-3',
    crawlerBays: [{ bayRef: 'nanite-processing-bay', condition }],
    scrapPool: { tl1: 2, inertNanites: 3 },
  })

describe('processDowntimeNanites', () => {
  test('spends every pile and keeps the 20s as Active Meld Nanites', async () => {
    const crawler = tenacity()
    const store = memoryStore(crawler)
    const rolls = [20, 3, 11]
    const said = processDowntimeNanites({
      crawler,
      store: store as never,
      rollD20: () => rolls.shift() ?? 1,
    })
    expect(said).toBe('Processed 3 Inert Meld Nanite piles and found 1 Active Meld Nanites.')
    await Promise.resolve()
    expect(store.read().scrapPool).toEqual({ tl1: 2, inertNanites: 0, activeNanites: 1 })
    expect(processDowntimeNanites({ crawler, store: store as never, rollD20: () => 20 })).toBe(
      'No Inert Meld Nanites to process.'
    )
  })

  test('a Damaged bay or no crawler processes nothing', () => {
    const crawler = tenacity('damaged')
    const store = memoryStore(crawler)
    expect(processDowntimeNanites({ crawler, store: store as never, rollD20: () => 20 })).toBeNull()
    expect(
      processDowntimeNanites({ crawler: null, store: store as never, rollD20: () => 20 })
    ).toBeNull()
    expect(naniteStatus(crawler)).toEqual({
      present: true,
      damaged: true,
      operational: false,
      inert: 3,
    })
    expect(naniteStatus(null).present).toBe(false)
  })
})
