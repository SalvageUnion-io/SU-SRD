import type { UnitsStore } from '../../../replica/units'
/**
 * CrawlerSheet — bay action economy tests (poster layout).
 *
 * The SP/Bays trackers live in the body's economy band (CrawlerLiveSheet); this
 * file covers the Bays section's interactive surface:
 *   1. Bay status: Intact bays lead with their function action; a Damaged bay
 *      disables the function and promotes Repair.
 *   2. Repair decrements 5 Scrap from the crawler-TL pool bucket, spilling
 *      into higher buckets, and flips the bay Intact.
 *   3. A short pool is advisory — Repair still proceeds, never blocks.
 *   4. readOnly suppresses every edit affordance.
 *   5. The Storage Bay's Scrap Pool steppers hand-edit `crawler.scrapPool`
 *      (Free Edit) — a crawler can stow arbitrary scrap by tech level, and
 *      Bio-Salvage, Chimerium and Meld Nanites beside it.
 *   6. Edit installs an expansion bay, and removes one; base bays stay.
 *
 * Uses the store-injection seam + a patched CrawlerBays.all. NO mock.module().
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { RefCrawlerBay } from 'salvageunion-reference'
import { patchModelRows } from '../../../../test/patchModel'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_TXN } from '../../../replica/provenance'
import { CrawlerSheet } from '../CrawlerSheet'

// ---------------------------------------------------------------------------
// SalvageUnionReference.CrawlerBays.all patch (so bays resolve in the sheet)
// ---------------------------------------------------------------------------

const MOCK_BAYS: Array<RefCrawlerBay & { schemaName: string }> = [
  {
    id: 'command-bay',
    name: 'Command Bay',
    schemaName: 'crawler-bays',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    npc: { position: 'Princeps', hitPoints: 4 },
  },
  {
    id: 'mech-bay',
    name: 'Mech Bay',
    schemaName: 'crawler-bays',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    npc: { position: 'Greaser', hitPoints: 4 },
  },
  {
    id: 'nanite-processing-bay',
    name: 'Nanite Processing Bay',
    schemaName: 'crawler-bays',
    source: 'False Flag',
    page: 66,
    expansion: true,
  } as RefCrawlerBay & { schemaName: string },
]

async function patchCrawlerBays(): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  return patchModelRows(SalvageUnionReference.CrawlerBays, MOCK_BAYS)
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
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

type Spies = {
  update: ReturnType<typeof mock>
  updateCrawlerBay: ReturnType<typeof mock>
}

function makeStubStore(crawler: Crawler, spies?: Partial<Spies>): UnitsStore {
  const update = spies?.update ?? mock(async () => crawler)
  const updateCrawlerBay = spies?.updateCrawlerBay ?? mock(async () => crawler)
  return makeEntityStoreMock({
    crawlers: [crawler],
    hydrated: { pilots: false, mechs: false, crawlers: true, npcs: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay,
    delete: mock(async () => {}),
  })
}

// ---------------------------------------------------------------------------
// Bay action economy
// ---------------------------------------------------------------------------

describe('CrawlerSheet — bay function/Repair actions', () => {
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
      fireEvent.click(must(repair))
    })

    // tech-2 crawler: 3 from tl2, then 2 from tl3 (TL+ scrap allowed).
    expect(update).toHaveBeenCalledWith(
      'crawler',
      fakeCrawler.id,
      {
        scrapPool: { tl2: 0, tl3: 2 },
      },
      LIVE_SHEET_TXN
    )
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'command-bay',
      { condition: 'intact' },
      0,
      LIVE_SHEET_TXN
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
      fireEvent.click(must(repair))
    })

    expect(update).toHaveBeenCalledWith(
      'crawler',
      broke.id,
      {
        scrapPool: { tl2: 0 },
      },
      LIVE_SHEET_TXN
    )
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      broke.id,
      'command-bay',
      { condition: 'intact' },
      0,
      LIVE_SHEET_TXN
    )
  })

  // The degenerate case of the one above, pinned separately because the draw
  // now runs through `drawFromPool`, whose DEFAULT behaviour is to refuse and
  // return null when the pool cannot cover the cost. Only `{ partial: true }`
  // keeps an empty pool repairing; drop that option and this test is what
  // catches it.
  test('an empty pool still repairs — nothing is drawn, the bay flips anyway', async () => {
    restore = await patchCrawlerBays()
    const empty: Crawler = { ...fakeCrawler, scrapPool: {} }
    const update = mock(async () => empty)
    const updateCrawlerBay = mock(async () => empty)
    render(
      <CrawlerSheet crawler={empty} store={makeStubStore(empty, { update, updateCrawlerBay })} />
    )

    const repair = screen
      .getAllByRole('button', { name: 'Repair' })
      .find((b) => !(b as HTMLButtonElement).disabled)
    expect(repair).toBeTruthy()
    await act(async () => {
      fireEvent.click(must(repair))
    })

    expect(update).toHaveBeenCalledWith('crawler', empty.id, { scrapPool: {} }, LIVE_SHEET_TXN)
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      empty.id,
      'command-bay',
      { condition: 'intact' },
      0,
      LIVE_SHEET_TXN
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
      name: 'Mech Bay status: Intact. Activate to mark Damaged',
    })
    await act(async () => {
      fireEvent.click(intactBadge)
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'mech-bay',
      { condition: 'damaged' },
      1,
      LIVE_SHEET_MANUAL
    )

    // Command Bay (damaged, index 0) → back to Intact, not Destroyed.
    const damagedBadge = screen.getByRole('button', {
      name: 'Command Bay status: Damaged. Activate to mark Intact',
    })
    await act(async () => {
      fireEvent.click(damagedBadge)
    })
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'command-bay',
      { condition: 'intact' },
      0,
      LIVE_SHEET_MANUAL
    )
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

  test('no Repair, no status toggle; stores never called', async () => {
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

    expect(screen.queryByRole('button', { name: /Status:/ })).toBeNull()
    // Read draws no controls at all: no Repair, no bay function.
    expect(screen.queryByRole('button', { name: 'Repair' })).toBeNull()

    expect(update).not.toHaveBeenCalled()
    expect(updateCrawlerBay).not.toHaveBeenCalled()
  })

  test('Read on a sheet its viewer may write still damages a bay', async () => {
    restore = await patchCrawlerBays()
    const updateCrawlerBay = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet
        crawler={fakeCrawler}
        store={makeStubStore(fakeCrawler, { updateCrawlerBay })}
        readOnly
        liveCondition
      />
    )
    const steppers = screen.getAllByRole('button', {
      name: /status: Intact\. Activate to mark Damaged/,
    })
    expect(steppers.length).toBeGreaterThan(0)
    // Only the condition steps: Read still draws no Repair.
    expect(screen.queryByRole('button', { name: 'Repair' })).toBeNull()
    fireEvent.click(steppers[0] as HTMLElement)
    await waitFor(() => expect(updateCrawlerBay).toHaveBeenCalledTimes(1))
  })
})

// ---------------------------------------------------------------------------
// Scrap Pool editor (Free Edit — stow arbitrary scrap by tech level)
// ---------------------------------------------------------------------------

describe('CrawlerSheet — Scrap Pool steppers', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('incrementing a tech-level bucket patches crawler.scrapPool', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)

    // fakeCrawler.scrapPool = { tl2: 3, tl3: 4 } → step T2 up to 4. Each TL box
    // labels its stepper `Increase T{n}`, so T2's increment is unique.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /increase t2/i }))
    })

    const call = update.mock.calls.at(-1) as [string, string, Record<string, unknown>] | undefined
    expect(call?.[0]).toBe('crawler')
    expect(call?.[2]).toMatchObject({ scrapPool: { tl2: 4, tl3: 4 } })
  })

  test('readOnly renders the pool as read-only (no steppers)', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} readOnly />
    )

    expect(screen.queryByRole('button', { name: /increase t2/i })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('CrawlerSheet — Bio-Salvage and Nanites, expansion bays', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('a resource stepper patches its bucket beside the Tech buckets', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /increase inert meld nanites/i }))
    })
    const call = update.mock.calls.at(-1) as [string, string, Record<string, unknown>] | undefined
    expect(call?.[2]).toMatchObject({ scrapPool: { tl2: 3, tl3: 4, inertNanites: 1 } })
  })

  test('Read leaves an empty resource row out', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} readOnly />)
    expect(screen.queryByText('Bio-Salvage & Nanites')).toBeNull()
  })

  test('Edit installs an expansion bay with its entry, and only an expansion bay is removable', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    const installed: Crawler = {
      ...fakeCrawler,
      crawlerBays: [...(fakeCrawler.crawlerBays ?? []), { bayRef: 'nanite-processing-bay' }],
    }
    const { unmount } = render(
      <CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />
    )
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Add an expansion bay' }), {
        target: { value: 'nanite-processing-bay' },
      })
    })
    const call = update.mock.calls.at(-1) as [string, string, Record<string, unknown>] | undefined
    expect(call?.[2]).toMatchObject({ crawlerBays: installed.crawlerBays })
    unmount()

    const removeSpy = mock(async () => installed)
    render(
      <CrawlerSheet crawler={installed} store={makeStubStore(installed, { update: removeSpy })} />
    )
    // Installed, it leaves the picker, and it alone offers Remove.
    expect(screen.queryByRole('combobox', { name: 'Add an expansion bay' })).toBeNull()
    const removes = screen.getAllByRole('button', { name: /remove/i })
    expect(removes.length).toBe(1)
    await act(async () => {
      fireEvent.click(must(removes[0]))
    })
    const removed = removeSpy.mock.calls.at(-1) as
      | [string, string, Record<string, unknown>]
      | undefined
    expect(removed?.[2]).toMatchObject({ crawlerBays: fakeCrawler.crawlerBays })
  })
})
