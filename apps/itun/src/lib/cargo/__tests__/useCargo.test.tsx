/**
 * Tests for the useCargo persistence wrapper: actions run the pure reducer
 * and write the changed sides back through the entity store (mech cargoLots;
 * crawler cargoLots + scrapPool). Reducer semantics themselves are covered in
 * cargoTransfer.test.ts.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, renderHook } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { useEntityStore } from '../../../stores/entityStore'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import type { CargoLot } from '../../schemas/cargoLot'
import { makeScrapLot } from '../../schemas/cargoLot'
import type { Crawler } from '../../schemas/crawler'
import type { Mech } from '../../schemas/mech'
import { useCargo } from '../useCargo'

beforeAll(async () => {
  // mechMaxCargo resolves the chassis through the ORM (even when the ref
  // doesn't match) — the chassis table must be loaded.
  await SalvageUnionReference.preload(['chassis'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Fixtures — chassisRef intentionally does not resolve, so the mech cargo cap
// comes purely from maxCargoModifier (no reference preload needed).
// ---------------------------------------------------------------------------

function makeMech(cargoLots: CargoLot[]): Mech {
  return {
    id: 'mech-1',
    schemaVersion: 1,
    name: 'Cargo Test Mech',
    chassisRef: 'unresolved-test-chassis',
    systems: [],
    modules: [],
    cargoLots,
    conditions: [],
    maxCargoModifier: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeCrawler(cargoLots: CargoLot[], scrapPool: Crawler['scrapPool']): Crawler {
  return {
    id: 'crawler-1',
    schemaVersion: 1,
    name: 'Cargo Test Crawler',
    techLevel: 'tech-3',
    systems: [],
    cargoLots,
    scrapPool,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

type CapturedUpdate = {
  type: string
  id: string
  patch: Record<string, unknown>
}

function makeStore(captured: CapturedUpdate[]): typeof useEntityStore {
  const update = mock(async (type: string, id: string, patch: Record<string, unknown>) => {
    captured.push({ type, id, patch })
    // The hook ignores update()'s resolved value; echo the patch back typed
    // against the store's entity union via a single (checked) assertion.
    return { id, ...patch } as Mech
  })
  return makeEntityStoreMock({
    update,
    // The hook commits through transfer() (atomic multi-entity write);
    // forward each update onto the capture list so assertions stay simple.
    transfer: mock(
      async (ops: { updates?: { type: string; id: string; patch: Record<string, unknown> }[] }) => {
        for (const u of ops.updates ?? []) await update(u.type, u.id, u.patch)
      }
    ),
  })
}

const unitLot: CargoLot = {
  id: 'lot-1',
  kind: 'unit',
  name: 'Spare Servo',
  cat: 'SYSTEM',
  units: 1,
  code: 'SRV',
}

// ---------------------------------------------------------------------------

describe('useCargo — persistence', () => {
  test('stow writes mech cargoLots and crawler cargoLots+scrapPool', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([unitLot]),
        crawler: makeCrawler([], {}),
        store: makeStore(captured),
      })
    )

    const outcome = await result.current.stow('lot-1')
    expect(outcome.ok).toBe(true)

    expect(captured).toHaveLength(2)
    expect(captured[0]).toMatchObject({
      type: 'mech',
      id: 'mech-1',
      patch: { cargoLots: [] },
    })
    expect(captured[1]?.type).toBe('crawler')
    expect(captured[1]?.patch.cargoLots).toEqual([unitLot])
    expect(captured[1]?.patch.scrapPool).toEqual({})
  })

  test('scrap stow round-trips through the crawler TL bucket', async () => {
    const captured: CapturedUpdate[] = []
    const scrap = makeScrapLot(3, 2)
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([scrap]),
        crawler: makeCrawler([], { tl3: 1 }),
        store: makeStore(captured),
      })
    )

    const outcome = await result.current.stow(scrap.id)
    expect(outcome.ok).toBe(true)
    expect(captured[1]?.patch.scrapPool).toEqual({ tl3: 3 })
    expect(captured[1]?.patch.cargoLots).toEqual([])
  })

  test('withdrawScrap mints the lot on the mech and decrements the pool', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([]),
        crawler: makeCrawler([], { tl2: 5 }),
        store: makeStore(captured),
      })
    )

    const outcome = await result.current.withdrawScrap(2, 3)
    expect(outcome.ok).toBe(true)
    const mechPatch = captured[0]?.patch.cargoLots as CargoLot[]
    expect(mechPatch[0]).toMatchObject({
      cat: 'SCRAP',
      tl: 2,
      qty: 3,
      units: 3,
    })
    expect(captured[1]?.patch.scrapPool).toEqual({ tl2: 2 })
  })

  test('a refused transfer persists nothing', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([]),
        crawler: makeCrawler([], {}),
        store: makeStore(captured),
      })
    )

    const outcome = await result.current.load('missing-lot')
    expect(outcome.ok).toBe(false)
    expect(captured).toHaveLength(0)
  })

  test('refuses with an honest reason when no crawler is linked', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([unitLot]),
        crawler: null,
        store: makeStore(captured),
      })
    )

    const outcome = await result.current.stow('lot-1')
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected refusal')
    expect(outcome.reason).toContain('crawler')
    expect(captured).toHaveLength(0)
  })

  test('readOnly refuses every transfer', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([unitLot]),
        crawler: makeCrawler([], {}),
        store: makeStore(captured),
        readOnly: true,
      })
    )

    const outcome = await result.current.stow('lot-1')
    expect(outcome.ok).toBe(false)
    expect(captured).toHaveLength(0)
  })

  test('usage and poolBucket expose honest derived state', () => {
    const over: CargoLot = { ...unitLot, id: 'big', units: 9 }
    const { result } = renderHook(() =>
      useCargo({
        mech: makeMech([over]),
        crawler: makeCrawler([], { tl4: 7 }),
        store: makeStore([]),
      })
    )

    expect(result.current.usage).toEqual({
      used: 9,
      cap: 6,
      free: 0,
      over: true,
    })
    expect(result.current.poolBucket(4)).toBe(7)
    expect(result.current.poolBucket(1)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Container-local edits — each container is usable WITHOUT its counterpart.
// ---------------------------------------------------------------------------

describe('useCargo — mech hold works with no crawler', () => {
  test('addMechLot writes mech cargoLots only', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({ mech: makeMech([]), crawler: null, store: makeStore(captured) })
    )

    const added: CargoLot = { ...unitLot, id: 'lot-new', name: 'Water Barrel', units: 3 }
    const outcome = await result.current.addMechLot(added)
    expect(outcome.ok).toBe(true)

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({ type: 'mech', id: 'mech-1' })
    expect(captured[0]?.patch.cargoLots).toEqual([added])
  })

  test('removeMechLot writes mech cargoLots only', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({ mech: makeMech([unitLot]), crawler: null, store: makeStore(captured) })
    )

    const outcome = await result.current.removeMechLot('lot-1')
    expect(outcome.ok).toBe(true)

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({ type: 'mech', id: 'mech-1' })
    expect(captured[0]?.patch.cargoLots).toEqual([])
  })
})

describe('useCargo — Storage Bay works with no docked mech', () => {
  test('addCrawlerLot writes crawler cargoLots only', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({ mech: null, crawler: makeCrawler([], { tl3: 5 }), store: makeStore(captured) })
    )

    const added: CargoLot = { ...unitLot, id: 'lot-bay', name: 'Spare Track Link', units: 4 }
    const outcome = await result.current.addCrawlerLot(added)
    expect(outcome.ok).toBe(true)

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({ type: 'crawler', id: 'crawler-1' })
    expect(captured[0]?.patch.cargoLots).toEqual([added])
    // Scrap pool is not part of a Bay-local write.
    expect(captured[0]?.patch.scrapPool).toBeUndefined()
  })

  test('removeCrawlerLot writes crawler cargoLots only', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({ mech: null, crawler: makeCrawler([unitLot], {}), store: makeStore(captured) })
    )

    const outcome = await result.current.removeCrawlerLot('lot-1')
    expect(outcome.ok).toBe(true)

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({ type: 'crawler', id: 'crawler-1' })
    expect(captured[0]?.patch.cargoLots).toEqual([])
  })

  test('a Bay edit is refused when there is no crawler at all', async () => {
    const captured: CapturedUpdate[] = []
    const { result } = renderHook(() =>
      useCargo({ mech: makeMech([]), crawler: null, store: makeStore(captured) })
    )

    const outcome = await result.current.addCrawlerLot(unitLot)
    expect(outcome.ok).toBe(false)
    expect(captured).toHaveLength(0)
  })
})
