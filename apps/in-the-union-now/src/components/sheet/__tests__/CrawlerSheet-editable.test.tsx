/**
 * CrawlerSheet — bay action economy + scrap pool tests (plan 4.6).
 *
 * The SP/Bays trackers moved to the hero (Sheet.tsx, plan 4.1/4.2); this file
 * now covers the body's interactive surface:
 *   1. Bay status: Intact bays lead with their function action; a Damaged bay
 *      disables the function and promotes Repair (design §4.4 / pattern 8).
 *   2. Repair decrements 5 Scrap from the crawler-TL pool bucket, spilling
 *      into higher buckets, and flips the bay Intact (S12).
 *   3. A short pool is advisory — Repair still proceeds, never blocks (S12).
 *   4. The scrap-pool slab's TL buckets hand-edit via ±1 steppers (rules C5).
 *   5. readOnly suppresses every edit affordance.
 *
 * Uses the store-injection seam + a patched CrawlerBays.all. NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CrawlerSheet } from '../CrawlerSheet'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { useEntityStore } from '../../../stores/entityStore'

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// SalvageUnionReference.CrawlerBays.all patch (so bays resolve in the sheet)
// ---------------------------------------------------------------------------

const MOCK_BAYS = [
  {
    id: 'command-bay',
    name: 'Command Bay',
    schemaName: 'crawler-bays',
    npc: { position: 'Princeps', hitPoints: 4 },
  },
  {
    id: 'mech-bay',
    name: 'Mech Bay',
    schemaName: 'crawler-bays',
    npc: { position: 'Greaser', hitPoints: 4 },
  },
]

async function patchCrawlerBays(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  const original = SalvageUnionReference.CrawlerBays.all.bind(SalvageUnionReference.CrawlerBays)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.CrawlerBays.all = mock(() => MOCK_BAYS as any)
  return () => {
    SalvageUnionReference.CrawlerBays.all = original
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeCrawler: Crawler = {
  id: 'crawler-edit-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  currentSP: 20,
  scrapPool: { tl2: 3, tl3: 4 },
  crawlerBays: [
    { bayRef: 'command-bay', npcCurrentHP: 4, condition: 'damaged' },
    { bayRef: 'mech-bay', npcCurrentHP: 4 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type Spies = {
  update: ReturnType<typeof mock>
  updateCrawlerBay: ReturnType<typeof mock>
}

function makeStubStore(crawler: Crawler, spies?: Partial<Spies>): typeof useEntityStore {
  const update = spies?.update ?? mock(async () => crawler)
  const updateCrawlerBay = spies?.updateCrawlerBay ?? mock(async () => crawler)
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
    updateCrawlerBay,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

// ---------------------------------------------------------------------------
// Bay action economy
// ---------------------------------------------------------------------------

describe('CrawlerSheet — bay function/Repair actions (design §4.4, S12)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('intact bay leads with its function action; Repair is disabled', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)

    // Mech Bay is intact: 'Dock' enabled, its Repair disabled.
    const dock = screen.getByRole('button', { name: 'Dock' })
    expect((dock as HTMLButtonElement).disabled).toBe(false)
    const repairs = screen.getAllByRole('button', { name: 'Repair' })
    expect(repairs.length).toBe(2)
  })

  test('damaged bay disables its function action and promotes Repair', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)

    // Command Bay is damaged: 'Scan' disabled…
    const scan = screen.getByRole('button', { name: 'Scan' })
    expect((scan as HTMLButtonElement).disabled).toBe(true)
    // …and exactly one Repair (the damaged bay's) is enabled.
    const enabledRepairs = screen
      .getAllByRole('button', { name: 'Repair' })
      .filter((b) => !(b as HTMLButtonElement).disabled)
    expect(enabledRepairs.length).toBe(1)
  })

  test('Repair decrements 5 Scrap from the crawler-TL bucket (spilling higher) and flips the bay Intact', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    const updateCrawlerBay = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet
        crawler={fakeCrawler}
        store={makeStubStore(fakeCrawler, { update, updateCrawlerBay })}
      />
    )

    const repair = screen
      .getAllByRole('button', { name: 'Repair' })
      .find((b) => !(b as HTMLButtonElement).disabled)
    expect(repair).toBeTruthy()
    await act(async () => {
      fireEvent.click(repair!)
    })

    // tech-2 crawler: 3 from tl2, then 2 from tl3 (TL+ scrap allowed).
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      scrapPool: { tl2: 0, tl3: 2 },
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'command-bay',
      { condition: 'intact' },
      0
    )
  })

  test('a short pool is advisory — Repair still proceeds (never blocks)', async () => {
    restore = await patchCrawlerBays()
    const broke: Crawler = { ...fakeCrawler, scrapPool: { tl2: 1 } }
    const update = mock(async () => broke)
    const updateCrawlerBay = mock(async () => broke)
    render(
      <CrawlerSheet crawler={broke} store={makeStubStore(broke, { update, updateCrawlerBay })} />
    )

    const repair = screen
      .getAllByRole('button', { name: 'Repair' })
      .find((b) => !(b as HTMLButtonElement).disabled)
    expect(repair).toBeTruthy()
    await act(async () => {
      fireEvent.click(repair!)
    })

    expect(update).toHaveBeenCalledWith('crawler', broke.id, {
      scrapPool: { tl2: 0 },
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      broke.id,
      'command-bay',
      { condition: 'intact' },
      0
    )
  })

  test('status badge toggles Intact ↔ Damaged (never Destroyed) via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet
        crawler={fakeCrawler}
        store={makeStubStore(fakeCrawler, { updateCrawlerBay })}
      />
    )

    // Mech Bay (intact, index 1) → Damaged.
    const intactBadge = screen.getByRole('button', {
      name: 'Mech Bay status: Intact — click to change',
    })
    await act(async () => {
      fireEvent.click(intactBadge)
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'mech-bay',
      { condition: 'damaged' },
      1
    )

    // Command Bay (damaged, index 0) → back to Intact, not Destroyed.
    const damagedBadge = screen.getByRole('button', {
      name: 'Command Bay status: Damaged — click to change',
    })
    await act(async () => {
      fireEvent.click(damagedBadge)
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'command-bay',
      { condition: 'intact' },
      0
    )
  })
})

// ---------------------------------------------------------------------------
// Scrap pool slab
// ---------------------------------------------------------------------------

describe('CrawlerSheet — scrap pool slab (rules C5)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders all six TL buckets with their values', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)

    expect(screen.getByRole('group', { name: 'Tech 2 scrap: 3' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Tech 3 scrap: 4' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Tech 6 scrap: 0' })).toBeTruthy()
  })

  test('incrementing a bucket persists scrapPool via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase Tech 4 scrap' }))
    })
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      scrapPool: { tl2: 3, tl3: 4, tl4: 1 },
    })
  })

  test('decrementing a bucket persists scrapPool via store.update', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decrease Tech 3 scrap' }))
    })
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      scrapPool: { tl2: 3, tl3: 3 },
    })
  })

  test('an empty bucket cannot go below zero (decrease disabled)', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)
    const dec = screen.getByRole('button', { name: 'Decrease Tech 6 scrap' })
    expect((dec as HTMLButtonElement).disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// readOnly
// ---------------------------------------------------------------------------

describe('CrawlerSheet — readOnly suppresses edits', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('no scrap steppers, no Repair, no status toggle; stores never called', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    const updateCrawlerBay = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet
        crawler={fakeCrawler}
        store={makeStubStore(fakeCrawler, { update, updateCrawlerBay })}
        readOnly
      />
    )

    expect(screen.queryByRole('button', { name: 'Increase Tech 4 scrap' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Status:/ })).toBeNull()
    const enabledRepairs = screen
      .getAllByRole('button', { name: 'Repair' })
      .filter((b) => !(b as HTMLButtonElement).disabled)
    expect(enabledRepairs.length).toBe(0)

    expect(update).not.toHaveBeenCalled()
    expect(updateCrawlerBay).not.toHaveBeenCalled()
  })
})
