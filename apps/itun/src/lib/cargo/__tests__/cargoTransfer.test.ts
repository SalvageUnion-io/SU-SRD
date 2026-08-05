/**
 * Tests for the pure cargoTransfer reducer (plan 4.1/4.7):
 * stow whole-lot, cap-checked load, bulk split minting a new lot, honest
 * over-capacity reporting, and the rules-major SCRAP TL pool bucket
 * round-trip across the crawler boundary.
 */

import { describe, expect, test } from 'bun:test'
import type { CargoLot } from '../../schemas/cargoLot'
import { makeScrapLot } from '../../schemas/cargoLot'
import type { CargoBoundaryState } from '../cargoTransfer'
import { addToScrapPool, cargoTransfer, carrierCargoUsage, scrapPoolBucket } from '../cargoTransfer'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function unitLot(overrides: Partial<CargoLot> = {}): CargoLot {
  return {
    id: 'lot-unit',
    kind: 'unit',
    name: 'Salvaged Reactor',
    cat: 'POWER',
    units: 2,
    code: 'SAL',
    ...overrides,
  }
}

function bulkLot(overrides: Partial<CargoLot> = {}): CargoLot {
  return {
    id: 'lot-bulk',
    kind: 'bulk',
    name: 'Sealed Crates',
    cat: 'SEALED',
    qty: 5,
    units: 5,
    code: 'CRT',
    ...overrides,
  }
}

function state(overrides: Partial<CargoBoundaryState> = {}): CargoBoundaryState {
  return {
    carrierLots: [],
    carrierCargoCap: 6,
    depotLots: [],
    scrapPool: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// carrierCargoUsage
// ---------------------------------------------------------------------------

describe('carrierCargoUsage', () => {
  test('sums units against the cap', () => {
    const usage = carrierCargoUsage([unitLot(), bulkLot()], 10)
    expect(usage).toEqual({ used: 7, cap: 10, free: 3, over: false })
  })

  test('over-capacity is reported honestly, never clamped', () => {
    const usage = carrierCargoUsage([bulkLot({ units: 9, qty: 9 })], 6)
    expect(usage.used).toBe(9)
    expect(usage.over).toBe(true)
    expect(usage.free).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Stow (mech → crawler)
// ---------------------------------------------------------------------------

describe('stow', () => {
  test('moves a whole lot to the front of the crawler hold', () => {
    const existing = unitLot({ id: 'lot-existing', name: 'Old Crate' })
    const s = state({ carrierLots: [unitLot()], depotLots: [existing] })

    const result = cargoTransfer(s, { type: 'stow', lotId: 'lot-unit' })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.carrierLots).toEqual([])
    expect(result.state.depotLots.map((l) => l.id)).toEqual(['lot-unit', 'lot-existing'])
    expect(result.changed).toEqual({ carrier: true, depot: true })
  })

  test('stows whole even when the lot is bulk (crawler is unlimited)', () => {
    const s = state({ carrierLots: [bulkLot()] })
    const result = cargoTransfer(s, { type: 'stow', lotId: 'lot-bulk' })
    if (!result.ok) throw new Error(result.reason)
    expect(result.state.depotLots).toHaveLength(1)
    expect(result.state.depotLots[0]?.qty).toBe(5)
  })

  test('refuses an unknown lot id', () => {
    const result = cargoTransfer(state(), { type: 'stow', lotId: 'nope' })
    expect(result.ok).toBe(false)
  })

  test('does not mutate the input state', () => {
    const s = state({ carrierLots: [unitLot()] })
    cargoTransfer(s, { type: 'stow', lotId: 'lot-unit' })
    expect(s.carrierLots).toHaveLength(1)
    expect(s.depotLots).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Load (crawler → mech)
// ---------------------------------------------------------------------------

describe('load — unit lots', () => {
  test('moves whole when it fits', () => {
    const s = state({ depotLots: [unitLot()] })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-unit' })
    if (!result.ok) throw new Error(result.reason)
    expect(result.state.carrierLots.map((l) => l.id)).toEqual(['lot-unit'])
    expect(result.state.depotLots).toEqual([])
  })

  test('refuses whole-or-not when the unit lot does not fit', () => {
    const s = state({
      carrierLots: [bulkLot({ id: 'filler', qty: 5, units: 5 })],
      depotLots: [unitLot({ units: 2 })],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-unit' })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected refusal')
    expect(result.reason).toContain('2 slots')
  })

  test('refuses when the mech hold is already full', () => {
    const s = state({
      carrierLots: [bulkLot({ id: 'filler', qty: 6, units: 6 })],
      depotLots: [unitLot({ units: 1 })],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-unit' })
    expect(result.ok).toBe(false)
  })

  test('an over-capacity mech hold refuses inbound but keeps its lots', () => {
    const over = bulkLot({ id: 'over', qty: 9, units: 9 })
    const s = state({
      carrierLots: [over],
      depotLots: [unitLot()],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-unit' })
    expect(result.ok).toBe(false)
    expect(s.carrierLots).toEqual([over])
  })
})

describe('load — bulk lots split', () => {
  test('partial load mints a NEW lot with a fresh id and decrements the source', () => {
    const s = state({
      depotLots: [bulkLot({ qty: 5, units: 5 })],
      carrierCargoCap: 3,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-bulk' })
    if (!result.ok) throw new Error(result.reason)

    expect(result.moved).toBe(3)
    const minted = result.state.carrierLots[0]
    if (!minted) throw new Error('expected a minted mech lot')
    expect(minted.id).not.toBe('lot-bulk')
    expect(minted.qty).toBe(3)
    expect(minted.units).toBe(3)
    expect(minted.name).toBe('Sealed Crates')

    const source = result.state.depotLots[0]
    if (!source) throw new Error('expected the source crawler lot')
    expect(source.id).toBe('lot-bulk')
    expect(source.qty).toBe(2)
    expect(source.units).toBe(2)
  })

  test('requested qty caps the move below the capacity limit', () => {
    const s = state({
      depotLots: [bulkLot({ qty: 5, units: 5 })],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, {
      type: 'load',
      lotId: 'lot-bulk',
      qty: 2,
    })
    if (!result.ok) throw new Error(result.reason)
    expect(result.moved).toBe(2)
    expect(result.state.carrierLots[0]?.qty).toBe(2)
    expect(result.state.depotLots[0]?.qty).toBe(3)
  })

  test('moving the entire quantity removes the source lot', () => {
    const s = state({
      depotLots: [bulkLot({ qty: 2, units: 2 })],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'lot-bulk' })
    if (!result.ok) throw new Error(result.reason)
    expect(result.moved).toBe(2)
    expect(result.state.depotLots).toEqual([])
  })

  test('multi-slot-per-unit bulk lots respect per-unit cost', () => {
    // 3 units of qty over 6 slot-units → 2 slots per unit; only 3 free → 1 fits.
    const heavy = bulkLot({ id: 'heavy', qty: 3, units: 6 })
    const s = state({
      carrierLots: [bulkLot({ id: 'filler', qty: 3, units: 3 })],
      depotLots: [heavy],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'heavy' })
    if (!result.ok) throw new Error(result.reason)
    expect(result.moved).toBe(1)
    expect(result.state.carrierLots[0]?.units).toBe(2)
    expect(result.state.depotLots[0]).toMatchObject({ qty: 2, units: 4 })
  })

  test('refuses when not even one bulk unit fits', () => {
    const heavy = bulkLot({ id: 'heavy', qty: 2, units: 6 }) // 3 slots per unit
    const s = state({
      carrierLots: [bulkLot({ id: 'filler', qty: 4, units: 4 })],
      depotLots: [heavy],
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'load', lotId: 'heavy' })
    expect(result.ok).toBe(false)
  })

  test('refuses an unknown lot id', () => {
    const result = cargoTransfer(state(), { type: 'load', lotId: 'nope' })
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Scrap pool helpers
// ---------------------------------------------------------------------------

describe('scrap pool helpers', () => {
  test('absent buckets read as 0', () => {
    expect(scrapPoolBucket({}, 3)).toBe(0)
  })

  test('addToScrapPool floors at 0 and leaves other buckets alone', () => {
    const pool = addToScrapPool({ tl2: 4 }, 2, -10)
    expect(pool.tl2).toBe(0)
    expect(scrapPoolBucket(addToScrapPool({ tl2: 4 }, 5, 3), 5)).toBe(3)
  })

  test('out-of-range tech levels are ignored', () => {
    expect(addToScrapPool({}, 7, 5)).toEqual({})
    expect(scrapPoolBucket({ tl1: 2 }, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// SCRAP lots crossing the crawler boundary (rules-major)
// ---------------------------------------------------------------------------

describe('SCRAP boundary — deposit on stow', () => {
  test('stowing a scrap lot deposits the matching TL bucket and mints NO crawler lot', () => {
    const scrap = makeScrapLot(3, 4)
    const s = state({ carrierLots: [scrap], scrapPool: { tl3: 1 } })

    const result = cargoTransfer(s, { type: 'stow', lotId: scrap.id })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.carrierLots).toEqual([])
    expect(result.state.depotLots).toEqual([])
    expect(result.state.scrapPool.tl3).toBe(5)
    expect(result.moved).toBe(4)
    expect(result.changed).toEqual({ carrier: true, depot: true })
  })

  test('different TLs land in different buckets', () => {
    const tl1 = makeScrapLot(1, 2)
    const tl6 = makeScrapLot(6, 3)
    let s = state({ carrierLots: [tl1, tl6] })

    let result = cargoTransfer(s, { type: 'stow', lotId: tl1.id })
    if (!result.ok) throw new Error(result.reason)
    s = result.state
    result = cargoTransfer(s, { type: 'stow', lotId: tl6.id })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.scrapPool).toEqual({ tl1: 2, tl6: 3 })
  })

  test('a legacy SCRAP lot already in the crawler hold loads like a normal lot (no pool change)', () => {
    const stray = makeScrapLot(2, 2)
    const s = state({ depotLots: [stray], scrapPool: { tl2: 7 } })
    const result = cargoTransfer(s, { type: 'load', lotId: stray.id })
    if (!result.ok) throw new Error(result.reason)
    expect(result.state.scrapPool.tl2).toBe(7)
    expect(result.state.carrierLots[0]?.cat).toBe('SCRAP')
  })
})

describe('SCRAP boundary — withdraw from the pool', () => {
  test('withdrawing mints a bulk SCRAP lot and decrements the bucket', () => {
    const s = state({ scrapPool: { tl4: 6 } })
    const result = cargoTransfer(s, { type: 'withdraw-scrap', tl: 4, qty: 3 })
    if (!result.ok) throw new Error(result.reason)

    expect(result.moved).toBe(3)
    expect(result.state.scrapPool.tl4).toBe(3)
    const lot = result.state.carrierLots[0]
    expect(lot).toMatchObject({
      kind: 'bulk',
      cat: 'SCRAP',
      tl: 4,
      qty: 3,
      units: 3,
    })
  })

  test('withdrawal merges into an existing same-TL bulk scrap lot', () => {
    const existing = makeScrapLot(2, 2)
    const s = state({ carrierLots: [existing], scrapPool: { tl2: 5 } })
    const result = cargoTransfer(s, { type: 'withdraw-scrap', tl: 2, qty: 2 })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.carrierLots).toHaveLength(1)
    expect(result.state.carrierLots[0]).toMatchObject({
      id: existing.id,
      qty: 4,
      units: 4,
    })
    expect(result.state.scrapPool.tl2).toBe(3)
  })

  test('withdrawal clamps to the bucket contents', () => {
    const s = state({ scrapPool: { tl1: 2 } })
    const result = cargoTransfer(s, { type: 'withdraw-scrap', tl: 1, qty: 99 })
    if (!result.ok) throw new Error(result.reason)
    expect(result.moved).toBe(2)
    expect(result.state.scrapPool.tl1).toBe(0)
  })

  test('withdrawal clamps to the mech free slots (partial fill)', () => {
    const s = state({
      carrierLots: [bulkLot({ id: 'filler', qty: 4, units: 4 })],
      scrapPool: { tl3: 10 },
      carrierCargoCap: 6,
    })
    const result = cargoTransfer(s, { type: 'withdraw-scrap', tl: 3, qty: 10 })
    if (!result.ok) throw new Error(result.reason)
    expect(result.moved).toBe(2)
    expect(result.state.scrapPool.tl3).toBe(8)
  })

  test('refuses an empty bucket, a full hold, bad TLs and non-positive quantities', () => {
    expect(cargoTransfer(state(), { type: 'withdraw-scrap', tl: 3, qty: 1 }).ok).toBe(false)
    expect(
      cargoTransfer(
        state({
          carrierLots: [bulkLot({ qty: 6, units: 6 })],
          scrapPool: { tl3: 5 },
        }),
        { type: 'withdraw-scrap', tl: 3, qty: 1 }
      ).ok
    ).toBe(false)
    expect(
      cargoTransfer(state({ scrapPool: { tl3: 5 } }), {
        type: 'withdraw-scrap',
        tl: 9,
        qty: 1,
      }).ok
    ).toBe(false)
    expect(
      cargoTransfer(state({ scrapPool: { tl3: 5 } }), {
        type: 'withdraw-scrap',
        tl: 3,
        qty: 0,
      }).ok
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Round-trip: the rules-major invariant
// ---------------------------------------------------------------------------

describe('SCRAP TL bucket round-trip', () => {
  test('stow then withdraw restores the mech lot and the pool', () => {
    const scrap = makeScrapLot(5, 4)
    const initial = state({ carrierLots: [scrap], scrapPool: { tl5: 2 } })

    const stowed = cargoTransfer(initial, { type: 'stow', lotId: scrap.id })
    if (!stowed.ok) throw new Error(stowed.reason)
    expect(stowed.state.scrapPool.tl5).toBe(6)
    expect(stowed.state.carrierLots).toEqual([])

    const withdrawn = cargoTransfer(stowed.state, {
      type: 'withdraw-scrap',
      tl: 5,
      qty: 4,
    })
    if (!withdrawn.ok) throw new Error(withdrawn.reason)

    expect(withdrawn.state.scrapPool.tl5).toBe(2)
    expect(withdrawn.state.carrierLots).toHaveLength(1)
    expect(withdrawn.state.carrierLots[0]).toMatchObject({
      kind: 'bulk',
      cat: 'SCRAP',
      tl: 5,
      qty: 4,
      units: 4,
    })
  })
})

// ---------------------------------------------------------------------------
// Mech-hold-local edits (add / remove) — NO crawler required
// ---------------------------------------------------------------------------

describe('add-carrier-lot', () => {
  test('prepends a lot to the mech hold; only the mech side changes', () => {
    const existing = unitLot({ id: 'lot-existing' })
    const added = unitLot({ id: 'lot-added', name: 'Water Barrel', units: 3 })
    const result = cargoTransfer(state({ carrierLots: [existing] }), {
      type: 'add-carrier-lot',
      lot: added,
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.carrierLots).toEqual([added, existing])
    expect(result.changed).toEqual({ carrier: true, depot: false })
  })

  test('adding over capacity is allowed (honest overflow, never clamped)', () => {
    // Cap 6, add an 8-unit lot → over capacity, still accepted.
    const result = cargoTransfer(state({ carrierCargoCap: 6 }), {
      type: 'add-carrier-lot',
      lot: unitLot({ id: 'lot-big', units: 8 }),
    })
    if (!result.ok) throw new Error(result.reason)

    const usage = carrierCargoUsage(result.state.carrierLots, result.state.carrierCargoCap)
    expect(usage.over).toBe(true)
    expect(usage.used).toBe(8)
  })
})

describe('remove-carrier-lot', () => {
  test('drops the named lot from the mech hold; only the mech side changes', () => {
    const keep = unitLot({ id: 'lot-keep' })
    const drop = unitLot({ id: 'lot-drop', name: 'Scrap Heap' })
    const result = cargoTransfer(state({ carrierLots: [keep, drop] }), {
      type: 'remove-carrier-lot',
      lotId: 'lot-drop',
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.carrierLots).toEqual([keep])
    expect(result.changed).toEqual({ carrier: true, depot: false })
  })

  test('refuses a lot that is not in the hold', () => {
    const result = cargoTransfer(state({ carrierLots: [unitLot()] }), {
      type: 'remove-carrier-lot',
      lotId: 'lot-missing',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not in the mech hold/i)
  })
})

describe('add-depot-lot', () => {
  test('prepends a lot to the Storage Bay; only the crawler side changes', () => {
    const existing = unitLot({ id: 'lot-existing' })
    const added = unitLot({ id: 'lot-added', name: 'Spare Track Link', units: 4 })
    const result = cargoTransfer(state({ depotLots: [existing] }), {
      type: 'add-depot-lot',
      lot: added,
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.depotLots).toEqual([added, existing])
    expect(result.changed).toEqual({ carrier: false, depot: true })
  })

  test('the Storage Bay is unlimited — a huge lot is still accepted', () => {
    const result = cargoTransfer(state(), {
      type: 'add-depot-lot',
      lot: unitLot({ id: 'lot-huge', units: 999 }),
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.depotLots).toHaveLength(1)
    // The mech hold's cap is untouched by a Storage Bay add.
    expect(result.state.carrierLots).toEqual([])
  })
})

describe('remove-depot-lot', () => {
  test('drops the named lot from the Storage Bay; only the crawler side changes', () => {
    const keep = unitLot({ id: 'lot-keep' })
    const drop = unitLot({ id: 'lot-drop', name: 'Rusted Plating' })
    const result = cargoTransfer(state({ depotLots: [keep, drop] }), {
      type: 'remove-depot-lot',
      lotId: 'lot-drop',
    })
    if (!result.ok) throw new Error(result.reason)

    expect(result.state.depotLots).toEqual([keep])
    expect(result.changed).toEqual({ carrier: false, depot: true })
  })

  test('refuses a lot that is not in the Storage Bay', () => {
    const result = cargoTransfer(state({ depotLots: [unitLot()] }), {
      type: 'remove-depot-lot',
      lotId: 'lot-missing',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not in the crawler storage bay/i)
  })

  test('the crawler scrap pool is untouched by Storage Bay add/remove', () => {
    const added = cargoTransfer(state({ scrapPool: { tl3: 5 } }), {
      type: 'add-depot-lot',
      lot: unitLot({ id: 'lot-x' }),
    })
    if (!added.ok) throw new Error(added.reason)
    expect(added.state.scrapPool).toEqual({ tl3: 5 })

    const removed = cargoTransfer(added.state, { type: 'remove-depot-lot', lotId: 'lot-x' })
    if (!removed.ok) throw new Error(removed.reason)
    expect(removed.state.scrapPool).toEqual({ tl3: 5 })
  })
})
