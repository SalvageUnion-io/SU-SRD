import { describe, it, expect } from 'bun:test'
import {
  pickRandomUndamagedBay,
  buildDeteriorationResult,
  computeCrawlerDeteriorationUpdate,
  buildPaidResult,
} from './deteriorationUtils'
import type { UpkeepResult } from './deteriorationUtils'
import type { BayNpcData, CrawlerRow } from '../types/common'

const BAY_IDS = ['bay-1', 'bay-2', 'bay-3']
const ALL_BAYS = [
  { id: 'bay-1', name: 'Command Bay' },
  { id: 'bay-2', name: 'Engineering Bay' },
  { id: 'bay-3', name: 'Trading Bay' },
]

function makeCrawler(overrides: Partial<CrawlerRow> = {}): CrawlerRow {
  return {
    id: 'crawler-1',
    user_id: 'user-1',
    crawler_ref: 'iron-mongrel',
    name: 'Test Crawler',
    tag: null,
    max_sp: 20,
    current_sp: 15,
    tech_level: 1,
    upkeep: 5,
    upgrade_pool: 0,
    scrap_tl1: 10,
    scrap_tl2: 0,
    scrap_tl3: 0,
    scrap_tl4: 0,
    scrap_tl5: 0,
    scrap_tl6: 0,
    bay_npcs: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CrawlerRow
}

describe('pickRandomUndamagedBay', () => {
  it('returns a bay when none are damaged', () => {
    const bayNpcs: Record<string, BayNpcData> = {}
    const result = pickRandomUndamagedBay(bayNpcs, BAY_IDS)
    expect(BAY_IDS).toContain(result!)
  })

  it('skips damaged bays', () => {
    const bayNpcs: Record<string, BayNpcData> = {
      'bay-1': { damaged: true },
      'bay-2': { damaged: true },
    }
    const result = pickRandomUndamagedBay(bayNpcs, BAY_IDS)
    expect(result).toBe('bay-3')
  })

  it('returns null when all bays are damaged', () => {
    const bayNpcs: Record<string, BayNpcData> = {
      'bay-1': { damaged: true },
      'bay-2': { damaged: true },
      'bay-3': { damaged: true },
    }
    const result = pickRandomUndamagedBay(bayNpcs, BAY_IDS)
    expect(result).toBeNull()
  })
})

describe('buildDeteriorationResult', () => {
  const emptyBayNpcs: Record<string, BayNpcData> = {}

  it('key "20" — no SP loss, no bay damage', () => {
    const result = buildDeteriorationResult('20', 'Lucky!', emptyBayNpcs, ALL_BAYS)
    expect(result.type).toBe('deteriorated')
    expect(result.spLost).toBe(0)
    expect(result.bayDamagedId).toBeNull()
    expect(result.selectionMethod).toBe('none')
  })

  it('key "11-19" — 5 SP loss, no bay damage', () => {
    const result = buildDeteriorationResult('11-19', 'Structural damage', emptyBayNpcs, ALL_BAYS)
    expect(result.spLost).toBe(5)
    expect(result.bayDamagedId).toBeNull()
    expect(result.selectionMethod).toBe('none')
  })

  it('key "6-10" — player bay selection (placeholder)', () => {
    const result = buildDeteriorationResult('6-10', 'Bay damage', emptyBayNpcs, ALL_BAYS)
    expect(result.spLost).toBe(0)
    expect(result.bayDamagedId).toBeNull()
    expect(result.selectionMethod).toBe('player')
  })

  it('key "2-5" — random bay damage', () => {
    const result = buildDeteriorationResult('2-5', 'Bay damage', emptyBayNpcs, ALL_BAYS)
    expect(result.spLost).toBe(0)
    expect(result.bayDamagedId).not.toBeNull()
    expect(result.selectionMethod).toBe('random')
  })

  it('key "2-5" with all bays damaged — null bay', () => {
    const allDamaged: Record<string, BayNpcData> = {
      'bay-1': { damaged: true },
      'bay-2': { damaged: true },
      'bay-3': { damaged: true },
    }
    const result = buildDeteriorationResult('2-5', 'Bay damage', allDamaged, ALL_BAYS)
    expect(result.bayDamagedId).toBeNull()
    expect(result.selectionMethod).toBe('random')
  })

  it('key "1" — 5 SP loss + random bay damage', () => {
    const result = buildDeteriorationResult('1', 'Critical!', emptyBayNpcs, ALL_BAYS)
    expect(result.spLost).toBe(5)
    expect(result.bayDamagedId).not.toBeNull()
    expect(result.selectionMethod).toBe('random')
  })

  it('preserves rollKey and rollText', () => {
    const result = buildDeteriorationResult('11-19', 'Damage text', emptyBayNpcs, ALL_BAYS)
    expect(result.rollKey).toBe('11-19')
    expect(result.rollText).toBe('Damage text')
  })
})

describe('computeCrawlerDeteriorationUpdate', () => {
  it('returns empty object for key "20" (no effect)', () => {
    const result: UpkeepResult = {
      type: 'deteriorated',
      rollKey: '20',
      spLost: 0,
      bayDamagedId: null,
      bayDamagedName: null,
      selectionMethod: 'none',
      upgradePoolGained: 0,
    }
    const update = computeCrawlerDeteriorationUpdate(result, makeCrawler())
    expect(Object.keys(update)).toHaveLength(0)
  })

  it('applies SP loss', () => {
    const result: UpkeepResult = {
      type: 'deteriorated',
      rollKey: '11-19',
      spLost: 5,
      bayDamagedId: null,
      bayDamagedName: null,
      selectionMethod: 'none',
      upgradePoolGained: 0,
    }
    const crawler = makeCrawler({ current_sp: 12 })
    const update = computeCrawlerDeteriorationUpdate(result, crawler)
    expect(update.current_sp).toBe(7)
  })

  it('clamps SP at 0', () => {
    const result: UpkeepResult = {
      type: 'deteriorated',
      rollKey: '1',
      spLost: 5,
      bayDamagedId: 'bay-1',
      bayDamagedName: 'Command Bay',
      selectionMethod: 'random',
      upgradePoolGained: 0,
    }
    const crawler = makeCrawler({ current_sp: 3 })
    const update = computeCrawlerDeteriorationUpdate(result, crawler)
    expect(update.current_sp).toBe(0)
  })

  it('marks bay as damaged', () => {
    const result: UpkeepResult = {
      type: 'deteriorated',
      rollKey: '2-5',
      spLost: 0,
      bayDamagedId: 'bay-2',
      bayDamagedName: 'Engineering Bay',
      selectionMethod: 'random',
      upgradePoolGained: 0,
    }
    const crawler = makeCrawler({ bay_npcs: { 'bay-1': { name: 'Alice' } } })
    const update = computeCrawlerDeteriorationUpdate(result, crawler)
    const bayNpcs = update.bay_npcs as Record<string, BayNpcData>
    expect(bayNpcs['bay-2']?.damaged).toBe(true)
    // Existing bay data preserved
    expect(bayNpcs['bay-1']?.name).toBe('Alice')
  })

  it('applies both SP loss and bay damage for key "1"', () => {
    const result: UpkeepResult = {
      type: 'deteriorated',
      rollKey: '1',
      spLost: 5,
      bayDamagedId: 'bay-3',
      bayDamagedName: 'Trading Bay',
      selectionMethod: 'random',
      upgradePoolGained: 0,
    }
    const crawler = makeCrawler({ current_sp: 20 })
    const update = computeCrawlerDeteriorationUpdate(result, crawler)
    expect(update.current_sp).toBe(15)
    const bayNpcs = update.bay_npcs as Record<string, BayNpcData>
    expect(bayNpcs['bay-3']?.damaged).toBe(true)
  })
})

describe('buildPaidResult', () => {
  it('returns a paid result with correct upgrade pool', () => {
    const result = buildPaidResult(5)
    expect(result.type).toBe('paid')
    expect(result.upgradePoolGained).toBe(5)
    expect(result.spLost).toBe(0)
    expect(result.bayDamagedId).toBeNull()
  })
})
