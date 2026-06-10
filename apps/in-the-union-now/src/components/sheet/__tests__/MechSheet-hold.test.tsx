/**
 * MechSheet — The Hold (StorageManifest side='mech', plan 4.5/4.7).
 *
 * The hold renders the mech's cargo lots over the useCargo boundary:
 *   - Stow → moves a whole lot to the linked crawler's hold.
 *   - Stowing a SCRAP lot deposits the crawler's matching TL pool bucket
 *     instead of minting a crawler lot.
 *   - Unlinked crawler → Stow disabled with an honest title reason.
 *   - Over-capacity renders honest red pips (data-cpip="over"), never
 *     clamped.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { MechSheet } from '../MechSheet'
import { makeScrapLot, makeUnitLot } from '../../../lib/schemas/cargoLot'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

function makeMech(overrides: Partial<Mech>): Mech {
  return {
    id: 'mech-hold-1',
    schemaVersion: 1,
    name: 'Hold Test Mech',
    chassisRef: 'Scrapper', // real chassis — useCargo derives cargo cap (6) from the ORM
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-hold-1',
    schemaVersion: 1,
    name: 'Hold Crawler',
    techLevel: 'tech-2',
    systems: [],
    cargoLots: [],
    scrapPool: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Crawler
}

type CapturedUpdate = {
  type: string
  id: string
  patch: Record<string, unknown>
}

function makeStore(mech: Mech, captured: CapturedUpdate[], crawler?: Crawler) {
  const storeState = {
    pilots: [],
    mechs: [mech],
    crawlers: crawler ? [crawler] : [],
    softLinks: [],
    hydrated: { pilots: false, mechs: true, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [mech]),
    get: mock((type: string, id: string) => {
      if (type === 'mech' && id === mech.id) return mech
      if (type === 'crawler' && crawler && id === crawler.id) return crawler
      return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => mech) as any,
    update: mock(
      async (type: string, id: string, patch: Record<string, unknown>) => {
        captured.push({ type, id, patch })
        return mech
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
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
    expect(captured[1]!.type).toBe('crawler')
    expect(captured[1]!.patch.cargoLots).toEqual([lot])
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
    expect(captured[0]!.patch).toEqual({ cargoLots: [] })
    const crawlerPatch = captured[1]!.patch as {
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

  test('over-capacity renders honest red pips (never clamped)', () => {
    // Cap 6 (Scrapper) but 8 units held → 2 over-pips.
    const mech = makeMech({
      cargoLots: [makeUnitLot('Big Thing', { units: 8 })],
    })
    const { container } = render(<MechSheet mech={mech} store={makeStore(mech, [])} />)

    expect(container.querySelectorAll('[data-cpip="over"]').length).toBe(2)
    expect(container.querySelectorAll('[data-cpip="on"]').length).toBe(6)
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
