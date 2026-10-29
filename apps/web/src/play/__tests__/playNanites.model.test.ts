/**
 * Processing Inert Meld Nanites from Play (`playNanites.model.ts`, False Flag
 * p.66): the write it makes, its words, and that it is claimed once per Downtime.
 */
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
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
    techLevel: 'tech-3',
    crawlerBays: [{ bayRef: 'nanite-processing-bay', condition }],
    scrapPool: { tl1: 2, inertNanites: 3 },
  })

const LABEL = 'Craft'

/** The Downtime's claim, as the room answers it: true the first time only. */
function onceClaim() {
  let claimed = false
  return async () => {
    if (claimed) return false
    claimed = true
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
      spendNanites: onceClaim(),
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
        spendNanites: onceClaim(),
      })
    ).toBe('No Inert Meld Nanites to process.')
  })

  test('a second claim this Downtime rolls nothing, even with piles back', async () => {
    const crawler = tenacity()
    const store = memoryStore(crawler)
    const spendNanites = onceClaim()
    const roll = { crawler, store: store as never, rollD20: () => 1, label: LABEL, spendNanites }
    await processDowntimeNanites(roll)
    await store.update('crawler', 'c', { scrapPool: { inertNanites: 2 } })
    expect(await processDowntimeNanites(roll)).toBe(
      'The Nanites are already processed this Downtime.'
    )
    expect(store.read().scrapPool).toEqual({ inertNanites: 2 })
  })

  test('a refused write says nothing was processed', async () => {
    const crawler = tenacity()
    const store = {
      ...memoryStore(crawler),
      update: async () => {
        throw new Error('refused')
      },
    }
    const quiet = spyOn(console, 'error').mockImplementation(() => undefined)
    expect(
      await processDowntimeNanites({
        crawler,
        store: store as never,
        rollD20: () => 20,
        label: LABEL,
        spendNanites: onceClaim(),
      })
    ).toBeNull()
    quiet.mockRestore()
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
        spendNanites: onceClaim(),
      })
    ).toBeNull()
    expect(
      await processDowntimeNanites({
        crawler: null,
        store: store as never,
        rollD20: () => 20,
        label: LABEL,
        spendNanites: onceClaim(),
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
