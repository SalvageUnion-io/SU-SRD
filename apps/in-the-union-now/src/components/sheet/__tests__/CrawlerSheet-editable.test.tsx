/**
 * CrawlerSheet — editable SP stat tests (#245) + per-bay NPC HP editing (#256)
 *
 * Asserts that:
 *   1. Editing SP calls store.update with { currentSP: <value> }
 *   2. readOnly suppresses editing (no spinbutton, no store.update)
 *   3. Editing a bay's NPC HP persists the whole crawlerBays array.
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
    delete: mock(async () => {}),
  }
  return (() => storeState) as unknown as typeof useEntityStore
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrawlerSheet — SP editing (#245)', () => {
  test('renders SP stat value', () => {
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)
    expect(screen.getByText('20')).toBeTruthy()
  })

  test('clicking SP value enters edit mode (shows spinbutton)', async () => {
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} />)
    const spValue = screen.getByText('20')
    await act(async () => {
      fireEvent.click(spValue)
    })
    expect(screen.getByRole('spinbutton')).toBeTruthy()
  })

  test('saving SP calls store.update with { currentSP }', async () => {
    const updateSpy = mock(async () => fakeCrawler)
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, updateSpy)} />)

    const spValue = screen.getByText('20')
    await act(async () => {
      fireEvent.click(spValue)
    })

    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '15' } })
      fireEvent.blur(input)
    })

    expect(updateSpy).toHaveBeenCalledWith('crawler', fakeCrawler.id, { currentSP: 15 })
  })
})

describe('CrawlerSheet — readOnly (#245)', () => {
  test('no edit spinbutton when readOnly', async () => {
    render(<CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler)} readOnly />)
    const spValue = screen.getByText('20')
    await act(async () => {
      fireEvent.click(spValue)
    })
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  test('store.update is never called when readOnly', async () => {
    const updateSpy = mock(async () => fakeCrawler)
    render(
      <CrawlerSheet crawler={fakeCrawler} store={makeStubStore(fakeCrawler, updateSpy)} readOnly />
    )

    const spValue = screen.getByText('20')
    await act(async () => {
      fireEvent.click(spValue)
    })

    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('CrawlerSheet — per-bay NPC HP editing (#256)', () => {
  let restore: () => void

  const crawlerWithBay: Crawler = {
    ...fakeCrawler,
    crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 4 }],
  }

  afterEach(() => {
    restore?.()
  })

  test('editing a bay NPC HP persists the full crawlerBays array', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerWithBay)
    render(
      <CrawlerSheet crawler={crawlerWithBay} store={makeStubStore(crawlerWithBay, updateSpy)} />
    )

    const hpField = screen.getByLabelText('Edit Command Bay NPC HP')
    await act(async () => {
      fireEvent.click(hpField)
    })
    const input = screen.getByRole('spinbutton')
    await act(async () => {
      fireEvent.change(input, { target: { value: '2' } })
      fireEvent.blur(input)
    })

    expect(updateSpy).toHaveBeenCalledWith('crawler', crawlerWithBay.id, {
      crawlerBays: [{ bayRef: 'command-bay', npcCurrentHP: 2 }],
    })
  })

  test('readOnly suppresses bay NPC HP editing', async () => {
    restore = await patchCrawlerBays()
    const updateSpy = mock(async () => crawlerWithBay)
    render(
      <CrawlerSheet
        crawler={crawlerWithBay}
        store={makeStubStore(crawlerWithBay, updateSpy)}
        readOnly
      />
    )

    const hpField = screen.getByLabelText('Edit Command Bay NPC HP')
    await act(async () => {
      fireEvent.click(hpField)
    })

    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
