/**
 * Tests for the usePartnerCargo persistence wrapper — specifically the
 * fresh-read guard its `useCargo` sibling has always had.
 *
 * A partner has no store row of its own: its lots persist as a patch to the
 * HOST's `partners` array, and that patch rebuilds the whole array. So a stale
 * read is doubly dangerous here — it can resurrect a lot the previous click
 * removed AND revert a concurrent edit to a sibling partner. Both are pinned
 * below.
 *
 * Reducer semantics themselves are covered in cargoTransfer.test.ts.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, renderHook } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import type { useEntityStore } from '../../../stores/entityStore'
import type { CargoLot } from '../../schemas/cargoLot'
import type { Crawler } from '../../schemas/crawler'
import type { Mech } from '../../schemas/mech'
import type { PartnerInstance } from '../../schemas/partner'
import { usePartnerCargo } from '../usePartnerCargo'

beforeAll(async () => {
  // partnerDerivedStats resolves the stat block through the ORM even when the
  // ref does not match, so the table must be loaded.
  await SalvageUnionReference.preload(['equipment'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Fixtures — hostRef intentionally does not resolve, so every derived stat is
// 0. Cargo capacity is irrelevant to the paths under test (stow and unload
// both move lots OFF the partner).
// ---------------------------------------------------------------------------

function lot(id: string, name: string): CargoLot {
  return { id, kind: 'unit', name, cat: 'SYSTEM', units: 1, code: 'X' }
}

function makePartner(id: string, cargoLots: CargoLot[], name?: string): PartnerInstance {
  return {
    id,
    hostRef: 'unresolved-test-partner',
    hostSchema: 'equipment',
    name,
    systems: [],
    modules: [],
    conditions: [],
    cargoLots,
  }
}

/**
 * A MECH host, not a pilot: mech-granted partners exercise the identical
 * `partners`-array write path with a far smaller required fixture.
 */
function makeHost(partners: PartnerInstance[]): Mech {
  return {
    id: 'mech-1',
    schemaVersion: 1,
    name: 'Cargo Test Mech',
    chassisRef: 'unresolved-test-chassis',
    systems: [],
    modules: [],
    conditions: [],
    cargoLots: [],
    partners,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeCrawler(cargoLots: CargoLot[]): Crawler {
  return {
    id: 'crawler-1',
    schemaVersion: 1,
    name: 'Cargo Test Crawler',
    techLevel: 'tech-3',
    systems: [],
    cargoLots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

type CapturedUpdate = { type: string; id: string; patch: Record<string, unknown> }

/**
 * Store double whose `get` returns the FRESH records while the hook is handed
 * the stale render-time ones — exactly the window a second click lands in.
 */
function makeStore(
  captured: CapturedUpdate[],
  fresh: { host?: Mech; crawler?: Crawler } = {}
): typeof useEntityStore {
  return makeEntityStoreMock({
    mechs: fresh.host ? [fresh.host] : [],
    crawlers: fresh.crawler ? [fresh.crawler] : [],
    transfer: mock(
      async (ops: { updates?: { type: string; id: string; patch: Record<string, unknown> }[] }) => {
        for (const u of ops.updates ?? []) captured.push(u)
      }
    ),
  })
}

function partnersIn(update: CapturedUpdate | undefined): PartnerInstance[] {
  return (update?.patch.partners ?? []) as PartnerInstance[]
}

// ---------------------------------------------------------------------------

describe('usePartnerCargo — fresh-read guard', () => {
  test('a second Unload cannot resurrect the lot the first one removed', async () => {
    const staleLots = [lot('lot-a', 'Spare Servo'), lot('lot-b', 'Coolant')]
    // The first click already landed: the store no longer holds lot-a.
    const freshHost = makeHost([makePartner('partner-1', [lot('lot-b', 'Coolant')])])
    const captured: CapturedUpdate[] = []

    const { result } = renderHook(() =>
      usePartnerCargo({
        found: {
          hostKind: 'mech',
          host: makeHost([makePartner('partner-1', staleLots)]),
          partner: makePartner('partner-1', staleLots),
        },
        techLevel: 3,
        store: makeStore(captured, { host: freshHost }),
      })
    )

    const outcome = await result.current.removeLot('lot-b')
    expect(outcome.ok).toBe(true)

    // Reduced against the fresh [lot-b], so the hold ends EMPTY. Against the
    // render-time [lot-a, lot-b] it would have written [lot-a] back.
    expect(partnersIn(captured[0])[0]?.cargoLots).toEqual([])
  })

  test('a repeat Unload of an already-removed lot refuses instead of writing', async () => {
    const staleLots = [lot('lot-a', 'Spare Servo')]
    const freshHost = makeHost([makePartner('partner-1', [])])
    const captured: CapturedUpdate[] = []

    const { result } = renderHook(() =>
      usePartnerCargo({
        found: {
          hostKind: 'mech',
          host: makeHost([makePartner('partner-1', staleLots)]),
          partner: makePartner('partner-1', staleLots),
        },
        techLevel: 3,
        store: makeStore(captured, { host: freshHost }),
      })
    )

    const outcome = await result.current.removeLot('lot-a')
    expect(outcome.ok).toBe(false)
    expect(captured).toHaveLength(0)
  })

  test('rebuilds the partners array from the fresh host, not the render-time one', async () => {
    const lots = [lot('lot-a', 'Spare Servo')]
    // A sibling partner was renamed after this component last rendered.
    const staleHost = makeHost([
      makePartner('partner-1', lots),
      makePartner('partner-2', [], 'Old Name'),
    ])
    const freshHost = makeHost([
      makePartner('partner-1', lots),
      makePartner('partner-2', [], 'New Name'),
    ])
    const captured: CapturedUpdate[] = []

    const { result } = renderHook(() =>
      usePartnerCargo({
        found: { hostKind: 'mech', host: staleHost, partner: makePartner('partner-1', lots) },
        techLevel: 3,
        store: makeStore(captured, { host: freshHost }),
      })
    )

    await result.current.removeLot('lot-a')

    expect(partnersIn(captured[0])[1]?.name).toBe('New Name')
  })

  test('stow reads the fresh crawler, so it appends rather than clobbers', async () => {
    const carried = [lot('lot-a', 'Spare Servo')]
    // Another surface stowed something into the Bay since this render.
    const freshCrawler = makeCrawler([lot('lot-z', 'Fuel Cell')])
    const freshHost = makeHost([makePartner('partner-1', carried)])
    const captured: CapturedUpdate[] = []

    const { result } = renderHook(() =>
      usePartnerCargo({
        found: {
          hostKind: 'mech',
          host: makeHost([makePartner('partner-1', carried)]),
          partner: makePartner('partner-1', carried),
        },
        techLevel: 3,
        crawler: makeCrawler([]),
        store: makeStore(captured, { host: freshHost, crawler: freshCrawler }),
      })
    )

    const outcome = await result.current.stow('lot-a')
    expect(outcome.ok).toBe(true)

    const depot = captured.find((u) => u.type === 'crawler')
    expect((depot?.patch.cargoLots as CargoLot[]).map((l) => l.id).sort()).toEqual([
      'lot-a',
      'lot-z',
    ])
  })

  test('a read-only sheet refuses every move without touching the store', async () => {
    const carried = [lot('lot-a', 'Spare Servo')]
    const captured: CapturedUpdate[] = []

    const { result } = renderHook(() =>
      usePartnerCargo({
        found: {
          hostKind: 'mech',
          host: makeHost([makePartner('partner-1', carried)]),
          partner: makePartner('partner-1', carried),
        },
        techLevel: 3,
        readOnly: true,
        store: makeStore(captured),
      })
    )

    expect((await result.current.removeLot('lot-a')).ok).toBe(false)
    expect(captured).toHaveLength(0)
  })
})
