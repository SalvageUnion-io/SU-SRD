/**
 * Processing Inert Meld Nanites from Play (`playNanites.model.ts`, False Flag
 * p.66): the op it sends, its words, and that it lands once per Downtime.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerFixture } from '../../components/__tests__/fixtures'
import { naniteStatus, processDowntimeNanites } from '../playNanites.model'
import type { PlayRoll } from '../playRolls.model'
import { clearPlayRolls, onPlayRoll } from '../playRolls.model'

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
    techLevel: 3,
    crawlerBays: [{ bayRef: 'nanite-processing-bay', condition }],
    scrapPool: { tl1: 2, inertNanites: 3 },
  })

const LABEL = 'Craft'

/** The Downtime's Nanites op, as the room answers it: applied the first time only. */
function onceClaim(store: ReturnType<typeof memoryStore>) {
  let claimed = false
  return async (_claim: string, id: string, patch: Partial<Crawler>) => {
    if (claimed) return false
    claimed = true
    await store.update('crawler', id, patch)
    return true
  }
}

describe('processDowntimeNanites', () => {
  afterEach(() => {
    mock.restore()
    clearPlayRolls()
  })

  test('spends every pile, keeps the 20s as Active Meld Nanites, and logs the dice', async () => {
    const crawler = tenacity()
    const store = memoryStore(crawler)
    const rolls = [20, 3, 11]
    const heard: PlayRoll[] = []
    const off = onPlayRoll((roll) => heard.push(roll))
    const said = await processDowntimeNanites({
      crawler,
      store: store as never,
      rollD20: () => rolls.shift() ?? 1,
      label: LABEL,
      claim: onceClaim(store),
    })
    expect(said).toBe('Processed 3 Inert Meld Nanite piles and found 1 Active Meld Nanites.')
    expect(store.read().scrapPool).toEqual({ tl1: 2, inertNanites: 0, activeNanites: 1 })
    off()
    expect(heard).toMatchObject([
      { tableName: 'Process Nanites', rolls: [20, 3, 11], label: LABEL, outcome: said },
    ])
    expect(
      await processDowntimeNanites({
        crawler,
        store: store as never,
        rollD20: () => 20,
        label: LABEL,
        claim: onceClaim(store),
      })
    ).toBe('No Inert Meld Nanites to process.')
  })

  test('a second claim this Downtime rolls nothing, even with piles back', async () => {
    const crawler = tenacity()
    const store = memoryStore(crawler)
    const claim = onceClaim(store)
    const roll = { crawler, store: store as never, rollD20: () => 1, label: LABEL, claim }
    await processDowntimeNanites(roll)
    await store.update('crawler', 'c', { scrapPool: { inertNanites: 2 } })
    expect(await processDowntimeNanites(roll)).toBe(
      'The Nanites are already processed this Downtime.'
    )
    expect(store.read().scrapPool).toEqual({ inertNanites: 2 })
  })

  test('a Damaged bay or no crawler processes nothing', async () => {
    const crawler = tenacity('damaged')
    const store = memoryStore(crawler)
    expect(
      await processDowntimeNanites({
        crawler,
        store: store as never,
        rollD20: () => 20,
        label: LABEL,
        claim: onceClaim(store),
      })
    ).toBeNull()
    expect(
      await processDowntimeNanites({
        crawler: null,
        store: store as never,
        rollD20: () => 20,
        label: LABEL,
        claim: onceClaim(store),
      })
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
