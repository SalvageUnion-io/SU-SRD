/**
 * MechSheet — The Hold (StorageManifest side='mech', plan 4.5/4.7).
 *
 * The hold renders the mech's cargo lots over the useCargo boundary:
 *   - Stow → moves a whole lot to the linked crawler's hold.
 *   - Stowing a SCRAP lot deposits the crawler's matching TL pool bucket
 *     instead of minting a crawler lot.
 *   - Unlinked crawler → Stow disabled with an honest title reason.
 *   - Over-capacity renders honest red SlotGrid cells (status-bad), never
 *     clamped.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeScrapLot, makeUnitLot } from '../../../lib/schemas/cargoLot'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import { crawlerFixture, mechFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { MechSheet } from '../MechSheet'

afterEach(() => {
  cleanup()
})

function makeMech(overrides: Partial<Mech>): Mech {
  return mechFixture({
    id: 'mech-hold-1',
    name: 'Hold Test Mech',
    chassisRef: 'Scrapper', // real chassis — useCargo derives cargo cap (6) from the ORM
    ...overrides,
  })
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return crawlerFixture({
    id: 'crawler-hold-1',
    name: 'Hold Crawler',
    techLevel: 'tech-2',
    cargoLots: [],
    scrapPool: {},
    ...overrides,
  })
}

type CapturedUpdate = {
  type: string
  id: string
  patch: Record<string, unknown>
}

function makeStore(mech: Mech, captured: CapturedUpdate[], crawler?: Crawler) {
  return makeEntityStoreMock({
    mechs: [mech],
    crawlers: crawler ? [crawler] : [],
    hydrated: { pilots: false, mechs: true, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === mech.id) return mech
      if (type === 'crawler' && crawler && id === crawler.id) return crawler
      return null
    }),
    create: mock(async () => mech),
    update: mock(async (type: string, id: string, patch: Record<string, unknown>) => {
      captured.push({ type, id, patch })
      return mech
    }),
    // Cargo stow/load commits through transfer(); capture its updates the
    // same way so assertions on `captured` keep working.
    transfer: mock(
      async (ops: { updates?: { type: string; id: string; patch: Record<string, unknown> }[] }) => {
        for (const u of ops.updates ?? []) captured.push({ type: u.type, id: u.id, patch: u.patch })
      }
    ),
    delete: mock(async () => {}),
  })
}

describe('MechSheet — The Hold (Stow →)', () => {
  test('stowing a unit lot moves it whole onto the crawler', async () => {
    const captured: CapturedUpdate[] = []
    const lot = makeUnitLot('Sealed Crate', { units: 2 })
    const mech = makeMech({ cargoLots: [lot] })
    const crawler = makeCrawler()
    render(<MechSheet mech={mech} store={makeStore(mech, captured, crawler)} crawler={crawler} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stow sealed crate/i }))
    })

    expect(captured.length).toBe(2)
    expect(captured[0]).toEqual({
      type: 'mech',
      id: mech.id,
      patch: { cargoLots: [] },
    })
    expect(must(captured[1]).type).toBe('crawler')
    expect(must(captured[1]).patch.cargoLots).toEqual([lot])
  })

  test('stowing a SCRAP lot deposits the matching TL pool bucket', async () => {
    const captured: CapturedUpdate[] = []
    const scrap = makeScrapLot(2, 3)
    const mech = makeMech({ cargoLots: [scrap] })
    const crawler = makeCrawler({ scrapPool: { tl2: 1 } })
    render(<MechSheet mech={mech} store={makeStore(mech, captured, crawler)} crawler={crawler} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stow .*scrap/i }))
    })

    expect(captured.length).toBe(2)
    expect(must(captured[0]).patch).toEqual({ cargoLots: [] })
    const crawlerPatch = must(captured[1]).patch as {
      cargoLots: unknown[]
      scrapPool: object
    }
    // The scrap entered the pool, NOT the crawler hold.
    expect(crawlerPatch.cargoLots).toEqual([])
    expect(crawlerPatch.scrapPool).toEqual({ tl2: 4 })
  })

  test('Stow is disabled with a reason when no crawler is linked', () => {
    const lot = makeUnitLot('Sealed Crate', { units: 2 })
    const mech = makeMech({ cargoLots: [lot] })
    render(<MechSheet mech={mech} store={makeStore(mech, [])} />)

    const stow = screen.getByRole('button', { name: /stow sealed crate/i })
    expect((stow as HTMLButtonElement).disabled).toBe(true)
    expect(stow.getAttribute('title')).toMatch(/no crawler linked/i)
  })

  test('over-capacity renders honest red SlotGrid cells (never clamped)', () => {
    // Cap 6 (Scrapper) but 8 units held → 2 over-capacity cells.
    const mech = makeMech({
      cargoLots: [makeUnitLot('Big Thing', { units: 8 })],
    })
    render(<MechSheet mech={mech} store={makeStore(mech, [])} />)

    // The capacity strip is the canonical SlotGrid: filled = cargo-toned
    // cells, over-capacity = status-bad cells, and the accessible label
    // narrates the overflow.
    const grid = screen.getByRole('img', {
      name: /hold 8 of 6 slots used — over capacity/i,
    })
    expect(grid.querySelectorAll('.bg-status-bad').length).toBe(2)
    expect(grid.querySelectorAll('.bg-cargo').length).toBe(6)
    expect(screen.getByText(/over capacity/i)).toBeTruthy()
  })

  test('the slab counts lots and slots truthfully', () => {
    const mech = makeMech({
      cargoLots: [makeUnitLot('Sealed Crate', { units: 2 }), makeScrapLot(1, 1)],
    })
    render(<MechSheet mech={mech} store={makeStore(mech, [])} />)

    expect(screen.getByText(/2 lots · 3\/6 slots/i)).toBeTruthy()
  })
})

describe('MechSheet — The Hold (standalone Load / Unload, no crawler)', () => {
  test('Load adds a new lot to a standalone mech hold (no crawler linked)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ cargoLots: [] })
    render(<MechSheet mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/new cargo name/i), {
        target: { value: 'Water Barrel' },
      })
      fireEvent.change(screen.getByLabelText(/new cargo slot cost/i), {
        target: { value: '3' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load cargo into the mech hold/i }))
    })

    expect(captured).toHaveLength(1)
    expect(must(captured[0]).type).toBe('mech')
    const lots = must(captured[0]).patch.cargoLots as Array<Record<string, unknown>>
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ name: 'Water Barrel', units: 3, kind: 'unit' })
  })

  test('the Scrap kind adds a tech-level scrap lot (cat SCRAP + tl + qty)', async () => {
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ cargoLots: [] })
    render(<MechSheet mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^scrap$/i }))
    })
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/scrap tech level/i), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText(/scrap quantity/i), { target: { value: '5' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load scrap into the mech hold/i }))
    })

    expect(captured).toHaveLength(1)
    const lots = must(captured[0]).patch.cargoLots as Array<Record<string, unknown>>
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ cat: 'SCRAP', tl: 3, qty: 5, units: 5, kind: 'bulk' })
  })

  test('a fractional slot cost is truncated, not silently dropped', async () => {
    // `CargoLotSchema.units` is `.int()`, and a `type="number"` field still
    // accepts a typed "1.5". Before coercion the lot failed its Zod parse on
    // commit while the form had already cleared — the cargo just vanished with
    // no feedback. It must round down and still save.
    const captured: CapturedUpdate[] = []
    const mech = makeMech({ cargoLots: [] })
    render(<MechSheet mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/new cargo name/i), {
        target: { value: 'Fuel Drum' },
      })
      fireEvent.change(screen.getByLabelText(/new cargo slot cost/i), {
        target: { value: '2.7' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load cargo into the mech hold/i }))
    })

    expect(captured).toHaveLength(1)
    const lots = must(captured[0]).patch.cargoLots as Array<Record<string, unknown>>
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ name: 'Fuel Drum', units: 2 })
  })

  test('Unload removes a lot from a standalone mech hold (no crawler linked)', async () => {
    const captured: CapturedUpdate[] = []
    const lot = makeUnitLot('Old Junk', { units: 2 })
    const mech = makeMech({ cargoLots: [lot] })
    render(<MechSheet mech={mech} store={makeStore(mech, captured)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /unload old junk/i }))
    })

    expect(captured).toHaveLength(1)
    expect(must(captured[0]).type).toBe('mech')
    expect(must(captured[0]).patch.cargoLots).toEqual([])
  })
})
