/**
 * CrawlerSheet — editable SP stat tests (#245)
 *
 * Asserts that:
 *   1. Editing SP calls store.update with { currentSP: <value> }
 *   2. readOnly suppresses editing (no spinbutton, no store.update)
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
// Helpers
// ---------------------------------------------------------------------------

const fakeCrawler: Crawler = {
  id: 'crawler-edit-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  bays: [],
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
