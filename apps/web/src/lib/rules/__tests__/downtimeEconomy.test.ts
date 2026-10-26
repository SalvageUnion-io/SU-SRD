/**
 * Downtime economy patch builders.
 *
 * They assert the seam: that a legal action produces the right write, and
 * that an illegal one produces NO write plus a reason.
 */

import { describe, expect, test } from 'bun:test'
import { makeScrapLot } from 'game-domain/schemas/cargoLot'
import type { ScrapPool } from 'game-domain/schemas/crawler'
import { areaSalvageResult } from 'salvageunion-reference/rules'
import type { WreckPart } from '../downtimeEconomy'
import {
  areaSalvageToMech,
  areaSalvageToPilot,
  depositScrapDeposits,
  wreckSalvageOutcome,
  wreckScrapOutcome,
} from '../downtimeEconomy'

const crawler = (over: Record<string, unknown> = {}) => ({
  techLevel: 'tech-3',
  scrapPool: { tl1: 10, tl2: 10, tl3: 10 },
  cargoLots: [],
  ...over,
})

describe('area salvage (F2)', () => {
  const found = (d20: number, areaTl = 2) => areaSalvageResult({ areaTl, d20 })

  test("a mech's Scrap lands in its Cargo Slots at the area Tech Level", () => {
    const { carried, leftBehind, patch } = areaSalvageToMech({ cargoLots: [] }, 6, found(11))
    expect(carried).toBe(3)
    expect(leftBehind).toBe(0)
    expect(patch?.cargoLots).toHaveLength(1)
    expect(patch?.cargoLots?.[0]).toMatchObject({ cat: 'SCRAP', tl: 2, qty: 3, units: 3 })
  })

  test("it stacks on the hold's Scrap of the same Tech Level", () => {
    const held = makeScrapLot(2, 2)
    const { patch } = areaSalvageToMech({ cargoLots: [held] }, 6, found(8))
    expect(patch?.cargoLots).toEqual([{ ...held, qty: 4, units: 4 }])
  })

  test('what has no Slot stays in the area', () => {
    const full = makeScrapLot(1, 5)
    const { carried, leftBehind } = areaSalvageToMech({ cargoLots: [full] }, 6, found(15))
    expect(carried).toBe(1)
    expect(leftBehind).toBe(2)
  })

  test('on foot it takes three Inventory Slots a Scrap, so a full pilot carries none', () => {
    const pilot = { equipment: [], genericInventory: [] }
    const two = areaSalvageToPilot(pilot, 6, found(11))
    expect(two.carried).toBe(2)
    expect(two.leftBehind).toBe(1)
    expect(two.patch?.genericInventory?.[0]).toMatchObject({
      name: 'Tech 2 Scrap',
      slotCost: 3,
      qty: 2,
    })
    const none = areaSalvageToPilot(pilot, 2, found(11))
    expect(none.patch).toBeNull()
    expect(none.leftBehind).toBe(3)
  })

  test('a nothing result makes NO write — a no-op would log a change that changed nothing', () => {
    expect(areaSalvageToMech({ cargoLots: [] }, 6, found(1)).patch).toBeNull()
  })

  test('a jackpot yields an item choice, not scrap — so also no cargo write', () => {
    const result = found(20)
    expect(result.requiresPlayerChoice).toBe(true)
    expect(areaSalvageToMech({ cargoLots: [] }, 6, result).patch).toBeNull()
  })
})

describe('mech salvage of a wreck (F2)', () => {
  const parts: WreckPart[] = [
    { key: 'c', kind: 'chassis', name: 'Mule', techLevel: 1, salvageValue: 7 },
    { key: 's', kind: 'system', name: 'Red Laser', techLevel: 1, salvageValue: 3 },
    { key: 'm', kind: 'module', name: 'Targeting Module', techLevel: 2, salvageValue: 2 },
  ]

  test('a 2–5 pays half the Chassis Salvage Value in Scrap of its Tech Level', () => {
    const { patch, taken } = wreckSalvageOutcome(crawler(), parts, 'nuts', [])
    expect(patch?.scrapPool?.tl1).toBe(13)
    expect(taken).toEqual(['3 Tech 1 Scrap'])
  })

  test('a pick lands in the hold, Damaged, at its Salvage Value in Slots', () => {
    const { patch, taken } = wreckSalvageOutcome(crawler(), parts, 'meat', ['c'])
    expect(taken).toEqual(['Mule'])
    expect(patch?.cargoLots?.[0]).toMatchObject({ name: 'Mule (Damaged)', units: 7, tl: 1 })
  })

  test('picks the band does not allow write nothing', () => {
    expect(wreckSalvageOutcome(crawler(), parts, 'bits', ['c']).patch).toBeNull()
    expect(wreckSalvageOutcome(crawler(), parts, 'meat', ['c', 's']).patch).toBeNull()
    expect(wreckSalvageOutcome(crawler(), parts, 'ashes', ['s']).patch).toBeNull()
  })

  test('a 20 takes the Chassis, a System and a Module', () => {
    const { patch } = wreckSalvageOutcome(crawler(), parts, 'lions', ['c', 's', 'm'])
    expect(patch?.cargoLots).toHaveLength(3)
  })

  test('a downed Vehicle scraps for its Salvage Value at its Tech Level', () => {
    expect(wreckScrapOutcome(crawler(), { techLevel: 2, salvageValue: 4 })?.scrapPool?.tl2).toBe(14)
  })
})

describe('depositScrapDeposits', () => {
  test('adds every deposit bucket onto the pool', () => {
    const pool: ScrapPool = { tl1: 2 }
    const next = depositScrapDeposits(pool, [
      { tl: 1, count: 7 },
      { tl: 2, count: 4 },
    ])
    expect(next).toEqual({ tl1: 9, tl2: 4 })
    // Pure — the input pool is untouched.
    expect(pool).toEqual({ tl1: 2 })
  })
})
