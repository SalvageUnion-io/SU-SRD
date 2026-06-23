/**
 * CrawlerSheet — tech-level upgrade flow (REQ-022, SRD p.218–219).
 *
 * Stepping the tech level UP opens an advisory confirm panel (cost preview +
 * soft warnings); confirming spends scrap (Upgrade Pool first, spilling into
 * current-TL+ buckets) and repairs damaged bays in one write-through. A short
 * pool is advisory, never a block (ADR-007). Downgrades commit immediately.
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
  await SalvageUnionReference.preload(['crawler-tech-levels'])
  const original = SalvageUnionReference.CrawlerBays.all.bind(SalvageUnionReference.CrawlerBays)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SalvageUnionReference.CrawlerBays.all = mock(() => MOCK_BAYS as any)
  return () => {
    SalvageUnionReference.CrawlerBays.all = original
  }
}

const fakeCrawler: Crawler = {
  id: 'crawler-upg-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-1',
  systems: [],
  currentSP: 20,
  upgradePool: 20,
  scrapPool: { tl1: 5, tl2: 10 },
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

describe('CrawlerSheet — tech-level upgrade flow (SRD p.218–219)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('stepping UP stages a confirm panel with the cost preview (does not write yet)', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set tech level 2' }))
    })

    // Tech-1 crawler: 30 Tech-1 Scrap to reach Tech 2.
    expect(screen.getByText('Upgrade to Tech 2 — costs 30 Tech-1 Scrap')).toBeTruthy()
    // No write until confirmed.
    expect(update).not.toHaveBeenCalled()
  })

  test('a short pool surfaces an advisory warning but still allows confirming', async () => {
    restore = await patchCrawlerBays()
    // Upgrade Pool 5 + tl1 3 = 8 available, well short of the 30 cost.
    const broke: Crawler = { ...fakeCrawler, upgradePool: 5, scrapPool: { tl1: 3 } }
    render(<CrawlerSheet crawler={broke} store={makeStubStore(broke)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set tech level 2' }))
    })

    // Advisory short-pool warning is shown…
    expect(screen.getByText(/short/i)).toBeTruthy()
    // …but the confirm button is still enabled (advisory, never a block).
    const confirm = screen.getByRole('button', { name: 'Confirm upgrade' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(false)
  })

  test('confirm spends Upgrade Pool first then current-TL+ buckets, and repairs damaged bays', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    const updateCrawlerBay = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet
        crawler={fakeCrawler}
        store={makeStubStore(fakeCrawler, { update, updateCrawlerBay })}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set tech level 2' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm upgrade' }))
    })

    // Cost 30: 20 from Upgrade Pool, remaining 10 from tl1 (5) then tl2 (5).
    expect(update).toHaveBeenCalledWith('crawler', fakeCrawler.id, {
      techLevel: 'tech-2',
      upgradePool: 0,
      scrapPool: { tl1: 0, tl2: 5 },
    })
    // The damaged Command Bay (index 0) is repaired to Intact.
    expect(updateCrawlerBay).toHaveBeenCalledWith(
      fakeCrawler.id,
      'command-bay',
      { condition: 'intact' },
      0
    )
    // The intact Mech Bay is NOT touched.
    expect(updateCrawlerBay).toHaveBeenCalledTimes(1)
  })

  test('cancel dismisses the panel without writing', async () => {
    restore = await patchCrawlerBays()
    const update = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, { update })} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set tech level 2' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(screen.queryByRole('group', { name: 'Confirm tech level upgrade' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  test('stepping DOWN commits immediately with no confirm panel', async () => {
    restore = await patchCrawlerBays()
    const downCrawler: Crawler = { ...fakeCrawler, techLevel: 'tech-3' }
    const update = mock(async () => downCrawler)
    render(<CrawlerSheet crawler={downCrawler} store={makeStubStore(downCrawler, { update })} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set tech level 2' }))
    })

    expect(screen.queryByRole('group', { name: 'Confirm tech level upgrade' })).toBeNull()
    expect(update).toHaveBeenCalledWith('crawler', downCrawler.id, { techLevel: 'tech-2' })
  })
})
