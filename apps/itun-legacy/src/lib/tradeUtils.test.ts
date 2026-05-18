import { describe, it, expect } from 'bun:test'
import {
  rollKeyToCategory,
  isTradeComplete,
  resolveTradeEntities,
  filterByTechLevel,
} from './tradeUtils'
import type { TradeResult } from './tradeUtils'

describe('rollKeyToCategory', () => {
  it('maps "1" to nothing', () => {
    expect(rollKeyToCategory('1')).toBe('nothing')
  })

  it('maps "2-5" to modules', () => {
    expect(rollKeyToCategory('2-5')).toBe('modules')
  })

  it('maps "6-10" to systems', () => {
    expect(rollKeyToCategory('6-10')).toBe('systems')
  })

  it('maps "11-19" to systems-and-modules', () => {
    expect(rollKeyToCategory('11-19')).toBe('systems-and-modules')
  })

  it('maps "20" to chassis', () => {
    expect(rollKeyToCategory('20')).toBe('chassis')
  })

  it('defaults to nothing for unknown keys', () => {
    expect(rollKeyToCategory('unknown')).toBe('nothing')
  })
})

describe('isTradeComplete', () => {
  it('returns false for null', () => {
    expect(isTradeComplete(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isTradeComplete(undefined)).toBe(false)
  })

  it('returns true for roll 1 (nothing)', () => {
    const result: TradeResult = { roll_key: '1', roll_value: 1 }
    expect(isTradeComplete(result)).toBe(true)
  })

  it('returns false for roll 2-5 without module selected', () => {
    const result: TradeResult = { roll_key: '2-5', roll_value: 3 }
    expect(isTradeComplete(result)).toBe(false)
  })

  it('returns true for roll 2-5 with module selected', () => {
    const result: TradeResult = {
      roll_key: '2-5',
      roll_value: 3,
      selected_module: 'a7411917-ee9a-48ac-b588-6606e03e58c1',
    }
    expect(isTradeComplete(result)).toBe(true)
  })

  it('returns false for roll 6-10 without system selected', () => {
    const result: TradeResult = { roll_key: '6-10', roll_value: 7 }
    expect(isTradeComplete(result)).toBe(false)
  })

  it('returns true for roll 6-10 with system selected', () => {
    const result: TradeResult = {
      roll_key: '6-10',
      roll_value: 7,
      selected_system: '418deda4-ab48-4bc4-a527-d56f4d77746e',
    }
    expect(isTradeComplete(result)).toBe(true)
  })

  it('returns false for roll 11-19 with only system selected', () => {
    const result: TradeResult = {
      roll_key: '11-19',
      roll_value: 15,
      selected_system: '418deda4-ab48-4bc4-a527-d56f4d77746e',
    }
    expect(isTradeComplete(result)).toBe(false)
  })

  it('returns false for roll 11-19 with only module selected', () => {
    const result: TradeResult = {
      roll_key: '11-19',
      roll_value: 15,
      selected_module: 'a7411917-ee9a-48ac-b588-6606e03e58c1',
    }
    expect(isTradeComplete(result)).toBe(false)
  })

  it('returns true for roll 11-19 with both system and module', () => {
    const result: TradeResult = {
      roll_key: '11-19',
      roll_value: 15,
      selected_system: '418deda4-ab48-4bc4-a527-d56f4d77746e',
      selected_module: 'a7411917-ee9a-48ac-b588-6606e03e58c1',
    }
    expect(isTradeComplete(result)).toBe(true)
  })

  it('returns false for roll 20 without chassis selected', () => {
    const result: TradeResult = { roll_key: '20', roll_value: 20 }
    expect(isTradeComplete(result)).toBe(false)
  })

  it('returns true for roll 20 with chassis selected', () => {
    const result: TradeResult = {
      roll_key: '20',
      roll_value: 20,
      selected_chassis: '40109396-2ee4-49ae-8290-2f435fd88c5e',
    }
    expect(isTradeComplete(result)).toBe(true)
  })
})

describe('resolveTradeEntities', () => {
  it('resolves a selected system', () => {
    const result: TradeResult = {
      roll_key: '6-10',
      roll_value: 7,
      selected_system: '418deda4-ab48-4bc4-a527-d56f4d77746e',
    }
    const entities = resolveTradeEntities(result)
    expect(entities).toHaveLength(1)
    expect(entities[0]!.schemaName).toBe('systems')
    expect(entities[0]!.entity.name).toBe('.50 Cal Machine Gun')
  })

  it('resolves a selected module', () => {
    const result: TradeResult = {
      roll_key: '2-5',
      roll_value: 3,
      selected_module: 'a7411917-ee9a-48ac-b588-6606e03e58c1',
    }
    const entities = resolveTradeEntities(result)
    expect(entities).toHaveLength(1)
    expect(entities[0]!.schemaName).toBe('modules')
    expect(entities[0]!.entity.name).toBe('Comms Module')
  })

  it('resolves a selected chassis', () => {
    const result: TradeResult = {
      roll_key: '20',
      roll_value: 20,
      selected_chassis: '40109396-2ee4-49ae-8290-2f435fd88c5e',
    }
    const entities = resolveTradeEntities(result)
    expect(entities).toHaveLength(1)
    expect(entities[0]!.schemaName).toBe('chassis')
    expect(entities[0]!.entity.name).toBe('Mule')
  })

  it('resolves system and module together', () => {
    const result: TradeResult = {
      roll_key: '11-19',
      roll_value: 15,
      selected_system: '418deda4-ab48-4bc4-a527-d56f4d77746e',
      selected_module: 'a7411917-ee9a-48ac-b588-6606e03e58c1',
    }
    const entities = resolveTradeEntities(result)
    expect(entities).toHaveLength(2)
    expect(entities.map((e) => e.schemaName)).toEqual(['systems', 'modules'])
  })

  it('returns empty array for nothing result', () => {
    const result: TradeResult = { roll_key: '1', roll_value: 1 }
    expect(resolveTradeEntities(result)).toEqual([])
  })

  it('skips unresolvable IDs gracefully', () => {
    const result: TradeResult = {
      roll_key: '6-10',
      roll_value: 7,
      selected_system: 'does-not-exist-xyz',
    }
    expect(resolveTradeEntities(result)).toEqual([])
  })
})

describe('filterByTechLevel', () => {
  it('includes entities with numeric TL <= crawlerTL', () => {
    const entities = [
      { name: 'A', techLevel: 1 },
      { name: 'B', techLevel: 2 },
    ]
    expect(filterByTechLevel(entities, 2)).toEqual(entities)
  })

  it('excludes entities with numeric TL > crawlerTL', () => {
    const entities = [
      { name: 'A', techLevel: 1 },
      { name: 'B', techLevel: 3 },
    ]
    expect(filterByTechLevel(entities, 2)).toEqual([{ name: 'A', techLevel: 1 }])
  })

  it('always includes entities with string techLevel (B, N)', () => {
    const entities = [
      { name: 'A', techLevel: 'B' as string | number },
      { name: 'B', techLevel: 'N' as string | number },
      { name: 'C', techLevel: 3 },
    ]
    expect(filterByTechLevel(entities, 1)).toEqual([
      { name: 'A', techLevel: 'B' },
      { name: 'B', techLevel: 'N' },
    ])
  })

  it('always includes entities with no techLevel', () => {
    const entities = [{ name: 'A' }, { name: 'B', techLevel: 5 }]
    expect(filterByTechLevel(entities, 1)).toEqual([{ name: 'A' }])
  })
})
