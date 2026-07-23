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

/**
 * The hook derives `state` from its props at render time. Per-lot Unload /
 * Unstow are buttons on a LIST, so two can fire before the store round-trip
 * re-renders — and if both reduce from that one snapshot, the second write
 * resurrects what the first removed. The local dispatchers re-read the entity
 * from the store before reducing, the same way the sheet controls do.
 */
describe('useCargo — dispatches reduce against a fresh read', () => {
  const lotA: CargoLot = {
    id: 'lot-a',
    kind: 'unit',
    name: 'Crate A',
    cat: 'SEALED',
    units: 1,
    code: 'CRA',
  }
  const lotB: CargoLot = {
    id: 'lot-b',
    kind: 'unit',
    name: 'Crate B',
    cat: 'SEALED',
    units: 1,
    code: 'CRB',
  }

  test('two Unloads before a re-render remove BOTH lots', async () => {
    const captured: CapturedUpdate[] = []
    // A store whose `get` reflects the most recent write, standing in for the
    // real store's write-through — while the hook's props stay at the stale
    // render-time value.
    const mech = makeMech([lotA, lotB])
    let live: Mech = mech
    const update = mock(async (type: string, id: string, patch: Record<string, unknown>) => {
      captured.push({ type, id, patch })
      live = { ...live, ...(patch as Partial<Mech>) }
      return live
    })
    const store = makeEntityStoreMock({
      get: (type: string, id: string) => (type === 'mech' && id === mech.id ? live : null),
      update,
      transfer: mock(
        async (ops: {
          updates?: { type: string; id: string; patch: Record<string, unknown> }[]
        }) => {
          for (const u of ops.updates ?? []) await update(u.type, u.id, u.patch)
        }
      ),
    }) as typeof useEntityStore

    const { result } = renderHook(() => useCargo({ mech, crawler: null, store }))

    await result.current.removeMechLot('lot-a')
    await result.current.removeMechLot('lot-b')

    expect(captured).toHaveLength(2)
    // The second write must be [] — NOT [lotA] recomputed from the stale snapshot.
    expect(captured[1]?.patch.cargoLots).toEqual([])
  })

  test('a rejected store write becomes a refusal, not an unhandled rejection', async () => {
    // `storeState.transfer` rejects when a patch fails its Zod parse. That must
    // reach the caller through the ordinary `{ ok: false, reason }` channel so
    // the UI can report it, rather than escaping as an unhandled rejection.
    const mech = makeMech([lotA])
    const store = makeEntityStoreMock({
      get: () => mech,
      update: mock(async () => {
        throw new Error('schema parse failed')
      }),
      transfer: mock(async () => {
        throw new Error('schema parse failed')
      }),
    }) as typeof useEntityStore

    const { result } = renderHook(() => useCargo({ mech, crawler: null, store }))

    const outcome = await result.current.removeMechLot('lot-a')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toContain('schema parse failed')
  })
})
