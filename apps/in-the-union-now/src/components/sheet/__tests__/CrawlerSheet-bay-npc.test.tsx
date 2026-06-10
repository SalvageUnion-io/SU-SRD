/**
 * CrawlerSheet — per-bay NPC Description + NPC Facts (Slice F, #239)
 *
 * Asserts that:
 *   1. NPC Description persists via store.update (merged into crawlerBays),
 *      without clobbering sibling bays.
 *   2. NPC Facts add/remove persist via store.update (merged), no sibling clobber.
 *   3. Values render.
 *   4. readOnly shows the values but exposes no edit controls.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CrawlerSheet } from '../CrawlerSheet'
import { CrawlerSchema } from '../../../lib/schemas/crawler'
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
    npc: { position: 'Mechanic', hitPoints: 4 },
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

const baseCrawler: Crawler = {
  id: 'crawler-npc-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  currentSP: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeStubStore(
  crawler: Crawler,
  updateSpy?: ReturnType<typeof mock>
): typeof useEntityStore {
  const updateMock = updateSpy ?? mock(async () => crawler)
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [crawler],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [crawler]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === crawler.id ? crawler : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => crawler) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    // CrawlerBayCard persists bay edits via the store-level per-bay merge
    // (plan 2.7) — same spy so existing not-called assertions still hold.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateCrawlerBay: updateMock as any,
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrawlerSheet — NPC Description (Slice F)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  const crawlerTwoBays: Crawler = {
    ...baseCrawler,
    crawlerBays: [
      { bayRef: 'command-bay', npcCurrentHP: 4, npcDescription: 'A stern veteran.' },
      { bayRef: 'mech-bay', npcCurrentHP: 4 },
    ],
  }

  test('renders the existing NPC description value', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={crawlerTwoBays} store={makeStubStore(crawlerTwoBays)} />)
    expect(screen.getByText('A stern veteran.')).toBeTruthy()
  })

  test('editing the description persists via the per-bay merge (no sibling clobber)', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerTwoBays)
    render(
      <CrawlerSheet crawler={crawlerTwoBays} store={makeStubStore(crawlerTwoBays, updateSpy)} />
    )

    const field = screen.getByLabelText('Edit Command Bay NPC description')
    await act(async () => {
      fireEvent.click(field)
    })
    const textarea = screen.getByLabelText('Edit Command Bay NPC description')
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'A grizzled commander.' } })
      fireEvent.blur(textarea)
    })

    expect(updateSpy).toHaveBeenCalledWith(
      crawlerTwoBays.id,
      'command-bay',
      { npcDescription: 'A grizzled commander.' },
      0
    )
  })

  test('readOnly shows description value but no edit control', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerTwoBays)
    render(
      <CrawlerSheet
        crawler={crawlerTwoBays}
        store={makeStubStore(crawlerTwoBays, updateSpy)}
        readOnly
      />
    )

    expect(screen.getByText('A stern veteran.')).toBeTruthy()
    const field = screen.getByLabelText('Edit Command Bay NPC description')
    await act(async () => {
      fireEvent.click(field)
    })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('CrawlerSchema — snapshot round-trip (Slice F)', () => {
  test('safeParse retains npcDescription + npcFacts on a crawlerBays entry', () => {
    const crawler: Crawler = {
      ...baseCrawler,
      crawlerBays: [
        {
          bayRef: 'command-bay',
          npcCurrentHP: 4,
          npcDescription: 'A stern veteran.',
          npcFacts: ['Hates synths', 'Owes a debt'],
        },
      ],
    }
    // SnapshotView round-trips player data through CrawlerSchema.safeParse before
    // rendering; assert the additive fields survive that parse (no .strip()).
    const result = CrawlerSchema.safeParse(crawler)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.crawlerBays?.[0]).toEqual({
        bayRef: 'command-bay',
        npcCurrentHP: 4,
        npcDescription: 'A stern veteran.',
        npcFacts: ['Hates synths', 'Owes a debt'],
      })
    }
  })
})

describe('CrawlerSheet — NPC Facts (Slice F)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  const crawlerTwoBays: Crawler = {
    ...baseCrawler,
    crawlerBays: [
      { bayRef: 'command-bay', npcCurrentHP: 4, npcFacts: ['Hates synths'] },
      { bayRef: 'mech-bay', npcCurrentHP: 4 },
    ],
  }

  test('renders existing facts', async () => {
    restore = await patchCrawlerBays()
    render(<CrawlerSheet crawler={crawlerTwoBays} store={makeStubStore(crawlerTwoBays)} />)
    expect(screen.getByText('Hates synths')).toBeTruthy()
  })

  test('adding a fact persists via the per-bay merge (no sibling clobber)', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerTwoBays)
    render(
      <CrawlerSheet crawler={crawlerTwoBays} store={makeStubStore(crawlerTwoBays, updateSpy)} />
    )

    const addBtn = screen.getByLabelText('Add Command Bay fact')
    await act(async () => {
      fireEvent.click(addBtn)
    })
    const input = screen.getByLabelText('New Command Bay fact')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Owes a debt' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateSpy).toHaveBeenCalledWith(
      crawlerTwoBays.id,
      'command-bay',
      { npcFacts: ['Hates synths', 'Owes a debt'] },
      0
    )
  })

  test('removing a fact persists via the per-bay merge', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerTwoBays)
    render(
      <CrawlerSheet crawler={crawlerTwoBays} store={makeStubStore(crawlerTwoBays, updateSpy)} />
    )

    const removeBtn = screen.getByLabelText('Remove Command Bay fact Hates synths')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(updateSpy).toHaveBeenCalledWith(crawlerTwoBays.id, 'command-bay', { npcFacts: [] }, 0)
  })

  test('readOnly shows facts but exposes no add/remove controls', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerTwoBays)
    render(
      <CrawlerSheet
        crawler={crawlerTwoBays}
        store={makeStubStore(crawlerTwoBays, updateSpy)}
        readOnly
      />
    )

    expect(screen.getByText('Hates synths')).toBeTruthy()
    expect(screen.queryByLabelText('Add Command Bay fact')).toBeNull()
    expect(screen.queryByLabelText('Remove Command Bay fact Hates synths')).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
