/**
 * CargoLotSchema tests (plan 2.3, design §2.12) — the rules-critical bit is
 * that SCRAP-category lots MUST carry a tech level (`tl`) so they can
 * deposit/withdraw the matching crawler scrap-pool bucket.
 */
import { describe, expect, test } from 'bun:test'

import {
  CargoLotSchema,
  cargoLotsFromLegacyCargo,
  makeScrapLot,
  makeUnitLot,
  normalizeLegacyCargoRecord,
  totalLotUnits,
} from '../cargoLot'

const validUnitLot = {
  id: 'lot-1',
  kind: 'unit' as const,
  name: 'Ration Pack',
  cat: 'SEALED' as const,
  units: 1,
  code: 'RAT',
}

describe('CargoLotSchema', () => {
  test('parses a valid unit lot', () => {
    expect(CargoLotSchema.safeParse(validUnitLot).success).toBe(true)
  })

  test('parses a valid bulk SCRAP lot with tl', () => {
    const result = CargoLotSchema.safeParse({
      id: 'lot-2',
      kind: 'bulk',
      name: 'Tech 3 Scrap',
      cat: 'SCRAP',
      tl: 3,
      qty: 5,
      units: 5,
      code: 'SCR-T3',
    })
    expect(result.success).toBe(true)
  })

  test('REJECTS a SCRAP lot without tl (rules-critical)', () => {
    const result = CargoLotSchema.safeParse({
      ...validUnitLot,
      cat: 'SCRAP',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['tl'])
    }
  })

  test('rejects tl outside 1–6 and unknown categories', () => {
    expect(CargoLotSchema.safeParse({ ...validUnitLot, cat: 'SCRAP', tl: 7 }).success).toBe(false)
    expect(CargoLotSchema.safeParse({ ...validUnitLot, cat: 'FOOD' }).success).toBe(false)
  })
})

describe('lot helpers', () => {
  test('makeUnitLot defaults: SEALED, 1 unit, derived code', () => {
    const lot = makeUnitLot('Salvaged plating')
    expect(CargoLotSchema.safeParse(lot).success).toBe(true)
    expect(lot.kind).toBe('unit')
    expect(lot.cat).toBe('SEALED')
    expect(lot.units).toBe(1)
    expect(lot.code).toBe('SAL')
  })

  test('makeScrapLot carries tl, qty, and 1 unit per scrap', () => {
    const lot = makeScrapLot(2, 4)
    expect(CargoLotSchema.safeParse(lot).success).toBe(true)
    expect(lot.cat).toBe('SCRAP')
    expect(lot.tl).toBe(2)
    expect(lot.qty).toBe(4)
    expect(lot.units).toBe(4)
  })

  test('totalLotUnits sums units', () => {
    expect(totalLotUnits([{ units: 1 }, { units: 3 }, { units: 0 }])).toBe(4)
    expect(totalLotUnits([])).toBe(0)
  })
})

describe('legacy cargo conversion', () => {
  test('cargoLotsFromLegacyCargo: 1-unit SEALED unit-lots, fresh ids', () => {
    const lots = cargoLotsFromLegacyCargo(['a', 'b'])
    expect(lots).toHaveLength(2)
    expect(new Set(lots.map((l) => l.id)).size).toBe(2)
    for (const lot of lots) {
      expect(CargoLotSchema.safeParse(lot).success).toBe(true)
      expect(lot.units).toBe(1)
    }
  })

  test('normalizeLegacyCargoRecord rewrites cargo → cargoLots and drops cargo', () => {
    const out = normalizeLegacyCargoRecord({
      id: 'm1',
      cargo: ['x'],
      name: 'Mech',
    })
    expect('cargo' in out).toBe(false)
    expect(Array.isArray(out.cargoLots)).toBe(true)
    expect((out.cargoLots as { name: string }[])[0]?.name).toBe('x')
  })

  test('normalizeLegacyCargoRecord passes through records without legacy cargo', () => {
    const record = { id: 'm1', cargoLots: [validUnitLot] }
    expect(normalizeLegacyCargoRecord(record)).toBe(record)
  })
})
