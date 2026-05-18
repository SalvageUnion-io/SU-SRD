import { describe, expect, test } from 'bun:test'
import { categorizeCargoItems, computeTallySummary, buildOffloadPayload } from './tallySalvageUtils'
import type { CargoRow } from '../types/common'

// --- Test helpers ---

function makeCargoRow(overrides: Partial<CargoRow> = {}): CargoRow {
  return {
    id: 'cargo-1',
    name: 'Test Cargo',
    amount: 1,
    parent_id: 'mech-1',
    parent_type: 'mech',
    schema_name: null,
    schema_ref_id: null,
    metadata: null,
    user_id: 'user-1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

function makeScrapRow(tl: number, amount: number, id?: string): CargoRow {
  return makeCargoRow({
    id: id ?? `scrap-tl${tl}`,
    name: `${amount}TL${tl} Scrap`,
    amount,
    metadata: { tech_level: tl },
  })
}

function makeEntityRow(
  id: string,
  schemaName: string,
  schemaRefId: string,
  name: string
): CargoRow {
  return makeCargoRow({
    id,
    name,
    schema_name: schemaName,
    schema_ref_id: schemaRefId,
  })
}

// --- Tests ---

describe('categorizeCargoItems', () => {
  test('separates raw scrap from entity items', () => {
    const cargo = [
      makeScrapRow(1, 3),
      makeScrapRow(2, 5),
      makeEntityRow('e1', 'systems', 'some-system', 'Laser Cannon'),
    ]

    const result = categorizeCargoItems(cargo)

    expect(result.rawScrap).toHaveLength(2)
    expect(result.rawScrap[0]).toEqual({ techLevel: 1, amount: 3 })
    expect(result.rawScrap[1]).toEqual({ techLevel: 2, amount: 5 })
    expect(result.entityItems).toHaveLength(1)
    expect(result.entityItems[0]!.cargoId).toBe('e1')
  })

  test('aggregates multiple scrap rows at same TL', () => {
    const cargo = [makeScrapRow(1, 3, 'scrap-1a'), makeScrapRow(1, 2, 'scrap-1b')]

    const result = categorizeCargoItems(cargo)

    expect(result.rawScrap).toHaveLength(1)
    expect(result.rawScrap[0]).toEqual({ techLevel: 1, amount: 5 })
  })

  test('returns empty arrays for empty cargo', () => {
    const result = categorizeCargoItems([])
    expect(result.rawScrap).toEqual([])
    expect(result.entityItems).toEqual([])
  })

  test('sorts raw scrap by tech level ascending', () => {
    const cargo = [makeScrapRow(3, 1), makeScrapRow(1, 2)]

    const result = categorizeCargoItems(cargo)

    expect(result.rawScrap[0]!.techLevel).toBe(1)
    expect(result.rawScrap[1]!.techLevel).toBe(3)
  })
})

describe('computeTallySummary', () => {
  const rawScrap = [
    { techLevel: 1, amount: 3 },
    { techLevel: 2, amount: 5 },
  ]

  const entityItems = [
    {
      cargoId: 'e1',
      name: 'System A',
      schemaName: 'systems',
      schemaRefId: 'sys-a',
      techLevel: 3,
      salvageValue: 5,
    },
    {
      cargoId: 'e2',
      name: 'Module B',
      schemaName: 'modules',
      schemaRefId: 'mod-b',
      techLevel: 2,
      salvageValue: 3,
    },
  ]

  test('all entity items default to scrap', () => {
    const result = computeTallySummary(rawScrap, entityItems, {})

    expect(result.scrapByTL[1]).toBe(3)
    expect(result.scrapByTL[2]).toBe(5 + 3) // raw + Module B
    expect(result.scrapByTL[3]).toBe(5) // System A
    expect(result.storageItems).toHaveLength(0)
  })

  test('items marked as storage go to storage', () => {
    const result = computeTallySummary(rawScrap, entityItems, {
      e1: 'storage',
    })

    expect(result.scrapByTL[1]).toBe(3)
    expect(result.scrapByTL[2]).toBe(8) // raw 5 + Module B 3
    expect(result.scrapByTL[3]).toBeUndefined()
    expect(result.storageItems).toHaveLength(1)
    expect(result.storageItems[0]!.cargoId).toBe('e1')
  })

  test('all items to storage means only raw scrap in totals', () => {
    const result = computeTallySummary(rawScrap, entityItems, {
      e1: 'storage',
      e2: 'storage',
    })

    expect(result.scrapByTL[1]).toBe(3)
    expect(result.scrapByTL[2]).toBe(5)
    expect(result.storageItems).toHaveLength(2)
  })
})

describe('buildOffloadPayload', () => {
  const rawScrap = [
    { techLevel: 1, amount: 3 },
    { techLevel: 2, amount: 5 },
  ]

  const entityItems = [
    {
      cargoId: 'e1',
      name: 'System A',
      schemaName: 'systems',
      schemaRefId: 'sys-a',
      techLevel: 3,
      salvageValue: 5,
    },
    {
      cargoId: 'e2',
      name: 'Module B',
      schemaName: 'modules',
      schemaRefId: 'mod-b',
      techLevel: 2,
      salvageValue: 3,
    },
  ]

  test('all default to scrap — no storage IDs, all scrap additions', () => {
    const result = buildOffloadPayload(rawScrap, entityItems, {})

    expect(result.storageCargoIds).toEqual([])
    expect(result.scrapAdditions).toEqual({
      '1': 3,
      '2': 8, // raw 5 + Module B 3
      '3': 5, // System A
    })
  })

  test('storage items produce storage cargo IDs', () => {
    const result = buildOffloadPayload(rawScrap, entityItems, {
      e1: 'storage',
    })

    expect(result.storageCargoIds).toEqual(['e1'])
    expect(result.scrapAdditions).toEqual({
      '1': 3,
      '2': 8,
    })
  })

  test('all to storage — only raw scrap in additions', () => {
    const result = buildOffloadPayload(rawScrap, entityItems, {
      e1: 'storage',
      e2: 'storage',
    })

    expect(result.storageCargoIds).toEqual(['e1', 'e2'])
    expect(result.scrapAdditions).toEqual({
      '1': 3,
      '2': 5,
    })
  })

  test('empty cargo produces empty payload', () => {
    const result = buildOffloadPayload([], [], {})

    expect(result.storageCargoIds).toEqual([])
    expect(result.scrapAdditions).toEqual({})
  })
})
