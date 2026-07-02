/**
 * CraftingControl — Crafting Bay flow tests (design-review R-7).
 *
 * Coverage:
 *   1. Gate: no Crafting Bay → note; Damaged Crafting Bay → blocked (p.222).
 *   2. The catalog only lists items at the crawler's TL or lower and the
 *      search filters it by name.
 *   3. Confirming a craft deducts the pool (item TL or higher, lowest bucket
 *      first) and deposits the item into the hold as an Intact lot (p.244).
 *   4. An unaffordable craft shows the shortfall and disables confirm.
 *
 * Uses the store-injection seam + patched reference model `.all`s (same
 * pattern as SalvageControl.test.tsx). Real crawler-bays data resolves the
 * bay gate.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { CraftingControl } from '../CraftingControl'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'

beforeAll(async () => {
  await SalvageUnionReference.preload(['crawler-bays'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Reference model patches (the craftable catalog)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Chassis.all = mock(() => MOCK_CHASSIS as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Systems.all = mock(() => MOCK_SYSTEMS as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.Modules.all = mock(() => MOCK_MODULES as any)
  return () => {
    SalvageUnionReference.Chassis.all = originals[0]
    SalvageUnionReference.Systems.all = originals[1]
    SalvageUnionReference.Modules.all = originals[2]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-craft-1',
    schemaVersion: 1,
    name: 'Iron Tortoise',
    techLevel: 'tech-1',
    systems: [],
    crawlerBays: [{ bayRef: 'Crafting Bay' }],
    scrapPool: { tl1: 5 },
    cargoLots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeStubStore(crawler: Crawler) {
  const update = mock<(type: string, id: string, patch: Partial<Crawler>) => Promise<Crawler>>(
    async () => crawler
  )
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay: mock(async () => crawler),
    delete: mock(async () => {}),
  }
  return { store: (() => storeState) as unknown as typeof useEntityStore, update }
}

// ---------------------------------------------------------------------------
// Gate (p.222)
// ---------------------------------------------------------------------------

describe('CraftingControl — gate (p.222)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('without a Crafting Bay nothing can be crafted', () => {
    restore = patchReference()
    const crawler = makeCrawler({ crawlerBays: [{ bayRef: 'Med Bay' }] })
    const { store } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    expect(screen.getByText('No Crafting Bay is installed on this crawler.')).toBeTruthy()
    expect(screen.queryByLabelText('Search the catalog')).toBeNull()
  })

  test('a Damaged Crafting Bay blocks crafting entirely', () => {
    restore = patchReference()
    const crawler = makeCrawler({
      crawlerBays: [{ bayRef: 'Crafting Bay', condition: 'damaged' }],
    })
    const { store } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    expect(screen.getByRole('alert').textContent).toContain('Crafting Bay is Damaged')
    expect(screen.queryByLabelText('Search the catalog')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Catalog + search
// ---------------------------------------------------------------------------

describe('CraftingControl — catalog (crawler TL or lower)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('only lists items at the crawler TL or lower; search filters by name', () => {
    restore = patchReference()
    const crawler = makeCrawler() // Tech 1
    const { store } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    // TL-1 catalog: Mule, Red Laser, Overdrive — the TL-2 Heavy Laser is out.
    expect(screen.getByRole('button', { name: 'Craft Mule' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Craft Red Laser' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Craft Overdrive' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Craft Heavy Laser' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Search the catalog'), {
      target: { value: 'laser' },
    })
    expect(screen.getByRole('button', { name: 'Craft Red Laser' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Craft Mule' })).toBeNull()
  })

  test('a Tech 2 crawler unlocks the Tech 2 catalog', () => {
    restore = patchReference()
    const crawler = makeCrawler({ techLevel: 'tech-2' })
    const { store } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    expect(screen.getByRole('button', { name: 'Craft Heavy Laser' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Craft confirm (p.244)
// ---------------------------------------------------------------------------

describe('CraftingControl — crafting (p.244)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('confirming deducts the pool and deposits an Intact lot into the hold', async () => {
    restore = patchReference()
    const crawler = makeCrawler() // Tech 1, pool { tl1: 5 }
    const { store, update } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Craft Red Laser' }))
    // The confirm dialog spells out the cost breakdown.
    expect(screen.getAllByText('Craft Red Laser?').length).toBeGreaterThan(0)
    expect(screen.getByText('3× T1')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Craft' }))
    })

    expect(update).toHaveBeenCalledTimes(1)
    const [, , patch] = update.mock.calls[0] as [string, string, Partial<Crawler>]
    expect(patch.scrapPool).toEqual({ tl1: 2 })
    expect(patch.cargoLots).toHaveLength(1)
    expect(patch.cargoLots?.[0]).toMatchObject({
      kind: 'unit',
      name: 'Red Laser',
      cat: 'SYSTEM',
      units: 3,
      tl: 1,
    })
    expect(screen.getByRole('status').textContent).toContain('Crafted Red Laser')
  })

  test('an unaffordable craft shows the shortfall and disables confirm', () => {
    restore = patchReference()
    const crawler = makeCrawler({ scrapPool: { tl1: 1 } })
    const { store, update } = makeStubStore(crawler)
    render(<CraftingControl crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Craft Red Laser' }))
    expect(screen.getByRole('alert').textContent).toContain('2 Scrap short')
    const confirm = screen.getByRole('button', { name: 'Craft' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })
})
