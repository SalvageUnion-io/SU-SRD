/**
 * ScrapMechControl — retire-a-mech helper tests (design-review R-7; p.248
 * Scrap ability).
 *
 * Coverage:
 *   1. Without a linked crawler the helper is disabled (no pool to deposit).
 *   2. The confirm dialog previews the full-SV per-TL deposit and calls out
 *      destroyed components (they yield nothing, p.245).
 *   3. Confirming deposits the buckets + hands off the mech's cargo onto the
 *      crawler, THEN deletes the mech entity.
 *
 * Uses the store-injection seam + patched reference model `.all`s (same
 * pattern as SalvageControl.test.tsx). No RouterProvider — navigation
 * degrades to a no-op via the useRouter probe.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { ScrapMechControl } from '../ScrapMechControl'
import { makeScrapLot, makeUnitLot } from '../../../lib/schemas/cargoLot'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Reference model patches
// ---------------------------------------------------------------------------

const MOCK_CHASSIS = [{ id: 'mule', name: 'Mule', techLevel: 1, salvageValue: 7 }]
const MOCK_SYSTEMS = [
  { id: 'red-laser', name: 'Red Laser', techLevel: 1, salvageValue: 3 },
  { id: 'heavy-laser', name: 'Heavy Laser', techLevel: 2, salvageValue: 4 },
]
const MOCK_MODULES = [{ id: 'overdrive', name: 'Overdrive', techLevel: 1, salvageValue: 2 }]

function patchReference(): () => void {
  const originals = [
    SalvageUnionReference.Chassis.all.bind(SalvageUnionReference.Chassis),
    SalvageUnionReference.Systems.all.bind(SalvageUnionReference.Systems),
    SalvageUnionReference.Modules.all.bind(SalvageUnionReference.Modules),
  ] as const
  SalvageUnionReference.Chassis.all = mock(
    () => MOCK_CHASSIS as unknown as ReturnType<typeof SalvageUnionReference.Chassis.all>
  )
  SalvageUnionReference.Systems.all = mock(
    () => MOCK_SYSTEMS as unknown as ReturnType<typeof SalvageUnionReference.Systems.all>
  )
  SalvageUnionReference.Modules.all = mock(
    () => MOCK_MODULES as unknown as ReturnType<typeof SalvageUnionReference.Modules.all>
  )
  return () => {
    SalvageUnionReference.Chassis.all = originals[0]
    SalvageUnionReference.Systems.all = originals[1]
    SalvageUnionReference.Modules.all = originals[2]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return {
    id: 'mech-scrap-1',
    schemaVersion: 1,
    name: 'Bullseye',
    chassisRef: 'Mule',
    systems: ['red-laser', 'heavy-laser'],
    modules: ['overdrive'],
    cargoLots: [],
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-scrap-1',
    schemaVersion: 1,
    name: 'Iron Tortoise',
    techLevel: 'tech-2',
    systems: [],
    scrapPool: { tl1: 1 },
    cargoLots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeStubStore(mech: Mech, crawler: Crawler) {
  const update = mock<
    (type: string, id: string, patch: Partial<Crawler | Mech>) => Promise<Crawler>
  >(async () => crawler)
  const del = mock<(type: string, id: string) => Promise<void>>(async () => {})
  const transfer = mock(
    async (ops: {
      updates?: { type: string; id: string; patch: Partial<Crawler | Mech> }[]
      deletes?: { type: string; id: string }[]
    }) => {
      for (const u of ops.updates ?? []) await update(u.type, u.id, u.patch)
      for (const d of ops.deletes ?? []) await del(d.type, d.id)
    }
  )
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => []),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === mech.id) return mech
      if (type === 'crawler' && id === crawler.id) return crawler
      return null
    }),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay: mock(async () => crawler),
    delete: del,
    transfer,
  }
  return { store: (() => storeState) as unknown as typeof useEntityStore, update, del }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScrapMechControl (p.248)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('is disabled without a linked crawler (no pool to deposit into)', () => {
    restore = patchReference()
    const mech = makeMech()
    const { store } = makeStubStore(mech, makeCrawler())
    render(<ScrapMechControl mech={mech} crawler={null} store={store} />)

    const btn = screen.getByRole('button', { name: 'Scrap this Mech' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  test('previews full SV per TL and calls out destroyed components', () => {
    restore = patchReference()
    const mech = makeMech({ systemConditions: { 'heavy-laser': 'destroyed' } })
    const crawler = makeCrawler()
    const { store } = makeStubStore(mech, crawler)
    render(<ScrapMechControl mech={mech} crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Scrap this Mech' }))

    // Mule 7 + Red Laser 3 + Overdrive 2 = 12× T1; the destroyed Heavy Laser
    // yields nothing.
    expect(screen.getAllByText('Scrap Bullseye?').length).toBeGreaterThan(0)
    expect(screen.getByText('12× T1')).toBeTruthy()
    expect(screen.getByText(/Heavy Laser \(destroyed\)/)).toBeTruthy()
  })

  test('confirming deposits scrap + hands off cargo, then deletes the mech', async () => {
    restore = patchReference()
    const scrapLot = makeScrapLot(2, 3)
    const crate = makeUnitLot('Sealed Crate')
    const mech = makeMech({
      systemConditions: { 'heavy-laser': 'destroyed' },
      cargoLots: [scrapLot, crate],
    })
    const crawler = makeCrawler()
    const { store, update, del } = makeStubStore(mech, crawler)
    render(<ScrapMechControl mech={mech} crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Scrap this Mech' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap it' }))
    })

    // One crawler write: 12× T1 on top of the existing 1, plus the stowed
    // SCRAP lot (3× T2) into the pool; the crate moves to the hold.
    expect(update).toHaveBeenCalledTimes(1)
    const [type, id, patch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(type).toBe('crawler')
    expect(id).toBe(crawler.id)
    expect(patch.scrapPool).toEqual({ tl1: 13, tl2: 3 })
    expect(patch.cargoLots?.map((l) => l.name)).toEqual(['Sealed Crate'])

    // …then the mech record is deleted (SoftLinks cascade in the real store).
    expect(del).toHaveBeenCalledWith('mech', mech.id)
  })

  test('a destroyed mech yields NO scrap and its cargo is lost (p.234/p.240 total loss)', async () => {
    restore = patchReference()
    const mech = makeMech({
      destroyed: true,
      // Stored conditions say intact — the mech-level flag overrides them.
      systemConditions: { 'red-laser': 'intact' },
      cargoLots: [makeScrapLot(2, 3), makeUnitLot('Sealed Crate')],
    })
    const crawler = makeCrawler()
    const { store, update, del } = makeStubStore(mech, crawler)
    render(<ScrapMechControl mech={mech} crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Scrap this Mech' }))
    expect(screen.getByText(/was destroyed/)).toBeTruthy()
    expect(screen.getByText('no Scrap', { exact: false })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scrap it' }))
    })

    // The crawler write books nothing: pool untouched, no cargo hand-off.
    expect(update).toHaveBeenCalledTimes(1)
    const [, , patch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(patch.scrapPool).toEqual({ tl1: 1 })
    expect(patch.cargoLots).toEqual([])

    expect(del).toHaveBeenCalledWith('mech', mech.id)
  })
})
