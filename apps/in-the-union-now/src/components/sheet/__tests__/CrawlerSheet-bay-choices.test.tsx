/**
 * CrawlerSheet — crawler-bay choice persistence tests (Slice B).
 *
 * Mirrors PilotSheet-equipment-choices.test.tsx for the crawler-bay surface.
 * Some SRD crawler bays carry `choices` (e.g. the Armament Bay's "Armament Bay
 * Weapons System" permanent pick). CrawlerSheet renders each installed bay via
 * CrawlerBayCard → ReferenceEntityDisplay with controlled selections wired to
 * the crawler's `bayChoices` map (keyed by the bay's `bayRef`).
 *
 * Asserts that:
 *   1. A choice-bearing bay renders its choice group + option cards.
 *   2. Toggling a choice persists to bayChoices[bayRef][choiceId] without
 *      clobbering sibling bays' choices.
 *   3. Persisted selections render as already-chosen (aria-pressed).
 *   4. readOnly snapshot renders persisted selections from the crawler prop even
 *      when the store has no entity.
 *   5. readOnly: choice cards render but toggling does not call store.update.
 *
 * Uses the store-injection seam + a patched CrawlerBays.all that returns a bay
 * fixture carrying enum `choiceOptions` (the real Armament Bay choice resolves a
 * `systems` schema whose option set is empty in the dataset, so a synthetic
 * fixture exercises the toggle path while keeping the persistence wiring real).
 * NO mock.module().
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
// Constants — synthetic choice-bearing bay. The choice is an exclusive
// (single-select) enum choice with two options rendered as toggle buttons.
// ---------------------------------------------------------------------------

const BAY_REF = 'armament-bay'
const CHOICE_ID = 'bay-weapon-choice-1'

const MOCK_BAYS = [
  {
    id: BAY_REF,
    name: 'Armament Bay',
    schemaName: 'crawler-bays',
    npc: { position: 'Gunny', hitPoints: 4 },
    choices: [
      {
        id: CHOICE_ID,
        name: 'Armament Bay Weapons System',
        choiceType: 'permanent',
        choiceOptions: [
          { value: 'Autocannon', label: 'Autocannon' },
          { value: 'Missile Pod', label: 'Missile Pod' },
        ],
        content: [{ type: 'paragraph', value: 'Choose a Weapons System.' }],
      },
    ],
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
// Store stubs — mutable backing entity so get() returns fresh state after update.
// ---------------------------------------------------------------------------

function makeCrawlerStubStore(initial: Crawler, updateSpy?: ReturnType<typeof mock>) {
  let current = initial
  const updateMock =
    updateSpy ??
    mock(async (_type: string, _id: string, patch: Partial<Crawler>) => {
      current = { ...current, ...patch }
      return current
    })

  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [current],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => [current]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock((_type: string, id: string) => (id === current.id ? current : null)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => current) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  const store = (() => storeState) as unknown as typeof useEntityStore
  return { store, updateMock }
}

// Empty store — get() always returns null, mirroring a share-link viewer who
// does NOT own the snapshot's crawler locally. Proves selections come from the
// crawler prop, not the live store.
function makeEmptyStore() {
  const updateMock = mock(async () => {
    throw new Error('update should not be called in read-only snapshot')
  })
  const storeState = {
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: true, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => []),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: mock(() => null) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: mock(async () => null) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateMock as any,
    delete: mock(async () => {}),
  }
  const store = (() => storeState) as unknown as typeof useEntityStore
  return { store, updateMock }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeCrawler(overrides?: Partial<Crawler>): Crawler {
  return {
    id: 'crawler-bay-choices-1',
    schemaVersion: 1,
    name: 'Iron Tortoise',
    techLevel: 'tech-2',
    crawlerBays: [{ bayRef: BAY_REF }],
    systems: [],
    currentSP: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrawlerSheet — bay choice cards (Slice B)', () => {
  let restore: () => void
  afterEach(() => {
    restore?.()
  })

  test('renders choice option cards for a choice-bearing bay', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler()
    const { store } = makeCrawlerStubStore(crawler)
    render(<CrawlerSheet crawler={crawler} store={store} />)

    expect(screen.getByRole('button', { name: /Autocannon/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Missile Pod/i })).toBeTruthy()
  })

  test('toggling a choice persists to bayChoices[bayRef][choiceId]', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler()
    const { store, updateMock } = makeCrawlerStubStore(crawler)
    render(<CrawlerSheet crawler={crawler} store={store} />)

    const autocannon = screen.getByRole('button', { name: /Autocannon/i })
    await act(async () => {
      fireEvent.click(autocannon)
    })

    expect(updateMock).toHaveBeenCalledWith('crawler', crawler.id, {
      bayChoices: {
        [BAY_REF]: { [CHOICE_ID]: ['Autocannon'] },
      },
    })
  })

  test('toggling does not clobber a sibling bay choice', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler({
      bayChoices: {
        'other-bay': { 'other-choice': ['Preserved'] },
      },
    })
    const { store, updateMock } = makeCrawlerStubStore(crawler)
    render(<CrawlerSheet crawler={crawler} store={store} />)

    const autocannon = screen.getByRole('button', { name: /Autocannon/i })
    await act(async () => {
      fireEvent.click(autocannon)
    })

    expect(updateMock).toHaveBeenCalledWith('crawler', crawler.id, {
      bayChoices: {
        'other-bay': { 'other-choice': ['Preserved'] },
        [BAY_REF]: { [CHOICE_ID]: ['Autocannon'] },
      },
    })
  })

  test('persisted selection renders as chosen (aria-pressed)', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler({
      bayChoices: { [BAY_REF]: { [CHOICE_ID]: ['Missile Pod'] } },
    })
    const { store } = makeCrawlerStubStore(crawler)
    render(<CrawlerSheet crawler={crawler} store={store} />)

    const missile = screen.getByRole('button', { name: /Missile Pod/i })
    expect(missile.getAttribute('aria-pressed')).toBe('true')

    const autocannon = screen.getByRole('button', { name: /Autocannon/i })
    expect(autocannon.getAttribute('aria-pressed')).toBe('false')
  })

  test('readOnly snapshot: persisted selection renders from the crawler prop even when the store has no entity', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler({
      bayChoices: { [BAY_REF]: { [CHOICE_ID]: ['Missile Pod'] } },
    })
    const { store } = makeEmptyStore()
    render(<CrawlerSheet crawler={crawler} store={store} readOnly />)

    const missile = screen.getByRole('button', { name: /Missile Pod/i })
    expect(missile.getAttribute('aria-pressed')).toBe('true')

    const autocannon = screen.getByRole('button', { name: /Autocannon/i })
    expect(autocannon.getAttribute('aria-pressed')).toBe('false')
  })

  test('readOnly: choice cards render but toggling does not persist', async () => {
    restore = await patchCrawlerBays()
    const crawler = makeCrawler()
    const { store, updateMock } = makeCrawlerStubStore(crawler)
    render(<CrawlerSheet crawler={crawler} store={store} readOnly />)

    const autocannon = screen.getByRole('button', { name: /Autocannon/i })
    expect(autocannon).toBeTruthy()

    await act(async () => {
      fireEvent.click(autocannon)
    })

    expect(updateMock).not.toHaveBeenCalled()
  })
})
