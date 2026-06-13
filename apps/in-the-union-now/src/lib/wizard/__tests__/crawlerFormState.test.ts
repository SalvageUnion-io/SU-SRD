/**
 * Unit tests for the crawler wizard form-state mappers (plan 3.1).
 *
 * The critical contract: crawlerFormToUpdatePatch contains ONLY wizard-owned
 * fields — an edit save must never clobber live-play state (bays + NPC HP,
 * bayChoices, currentSP, cargoLots, maxSpModifier, workspaceId).
 */
import { describe, expect, it } from 'bun:test'
import type { Crawler } from '../../schemas/crawler'
import { CrawlerSchema } from '../../schemas/crawler'
import {
  EMPTY_CRAWLER_FORM_STATE,
  EMPTY_SCRAP_POOL,
  crawlerFormToCreateInput,
  crawlerFormToUpdatePatch,
  crawlerToFormState,
  toScrapPoolPatch,
} from '../crawlerFormState'

const storedCrawler: Crawler = {
  id: 'c-1',
  schemaVersion: 1,
  name: 'The Wandering Kettle',
  techLevel: 'tech-3',
  crawlerBays: [
    {
      bayRef: 'command-bay',
      npcName: 'Vex',
      npcCurrentHP: 2,
      condition: 'damaged',
    },
    { bayRef: 'mech-bay', npcCurrentHP: 4 },
  ],
  systems: ['system-drill'],
  bayChoices: { 'command-bay': { 'choice-1': ['opt-a'] } },
  workspaceId: 'ws-1',
  currentSP: 24,
  scrapPool: { tl3: 5 },
  upgradePool: 18,
  cargoLots: [],
  maxSpModifier: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('crawlerToFormState', () => {
  it('maps every wizard-owned field from the stored crawler', () => {
    const form = crawlerToFormState(storedCrawler)
    expect(form).toEqual({
      name: 'The Wandering Kettle',
      techLevel: 3,
      systems: ['system-drill'],
      scrapPool: { ...EMPTY_SCRAP_POOL, tl3: 5 },
      upgradePool: 18,
    })
  })

  it('defaults absent scrapPool/upgradePool to zeros', () => {
    const form = crawlerToFormState({
      ...storedCrawler,
      scrapPool: undefined,
      upgradePool: undefined,
    })
    expect(form.scrapPool).toEqual(EMPTY_SCRAP_POOL)
    expect(form.upgradePool).toBe(0)
  })

  it('copies arrays defensively (mutating the form never touches the entity)', () => {
    const form = crawlerToFormState(storedCrawler)
    form.systems.push('system-shield')
    expect(storedCrawler.systems).toEqual(['system-drill'])
  })
})

describe('toScrapPoolPatch', () => {
  it('strips zero buckets and keeps positive ones', () => {
    expect(toScrapPoolPatch({ ...EMPTY_SCRAP_POOL, tl1: 2, tl6: 1 })).toEqual({
      tl1: 2,
      tl6: 1,
    })
  })

  it('returns an empty object when all buckets are zero', () => {
    expect(toScrapPoolPatch(EMPTY_SCRAP_POOL)).toEqual({})
  })
})

describe('crawlerFormToUpdatePatch', () => {
  it('contains ONLY wizard-owned fields — live-play state is never clobbered', () => {
    const patch = crawlerFormToUpdatePatch(crawlerToFormState(storedCrawler))
    expect(Object.keys(patch).sort()).toEqual([
      'name',
      'scrapPool',
      'systems',
      'techLevel',
      'upgradePool',
    ])
    expect(patch.techLevel).toBe('tech-3')
    expect(patch.scrapPool).toEqual({ tl3: 5 })
  })

  it('throws when no tech level is chosen', () => {
    expect(() => crawlerFormToUpdatePatch(EMPTY_CRAWLER_FORM_STATE)).toThrow(/tech level/i)
  })

  it('trims the name', () => {
    const patch = crawlerFormToUpdatePatch({
      ...EMPTY_CRAWLER_FORM_STATE,
      name: '  Bay Wagon  ',
      techLevel: 1,
    })
    expect(patch.name).toBe('Bay Wagon')
  })
})

describe('crawlerFormToCreateInput', () => {
  it('builds a CrawlerSchema-valid payload with seeded bays and full SP', () => {
    const input = crawlerFormToCreateInput(
      {
        name: 'Bay Wagon',
        techLevel: 1,
        systems: [],
        scrapPool: { ...EMPTY_SCRAP_POOL, tl1: 3 },
        upgradePool: 12,
      },
      {
        maxSP: 20,
        crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
      }
    )
    expect(input.schemaVersion).toBe(1)
    expect(input.techLevel).toBe('tech-1')
    expect(input.crawlerBays).toEqual([{ bayRef: 'command-bay', npcCurrentHP: 4 }])
    expect(input.currentSP).toBe(20)
    expect(input.scrapPool).toEqual({ tl1: 3 })
    expect(input.upgradePool).toBe(12)

    const parsed = CrawlerSchema.safeParse({
      ...input,
      id: 'temp',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })

  it('omits currentSP when the tech level has no known SP', () => {
    const input = crawlerFormToCreateInput(
      { ...EMPTY_CRAWLER_FORM_STATE, name: 'X', techLevel: 2 },
      { crawlerBays: [] }
    )
    expect('currentSP' in input).toBe(false)
  })
})
