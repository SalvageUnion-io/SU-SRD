/**
 * PilotSheet — Crawler Level (Slice E) tests.
 *
 * Asserts that:
 *   1. With NO associated crawler, an editable "Crawler Level" control renders
 *      (manual fallback) and persists to pilot.crawlerLevel.
 *   2. With an associated crawler (pilot-to-crawler SoftLink), the crawler's
 *      techLevel is shown read-only — no manual edit field, and it wins over any
 *      manual crawlerLevel.
 *   3. The effective level feeds the Modification choice cap: the `n/max` counter
 *      resolves to the effective level.
 *   4. With neither a crawler nor a manual level, the Modification cap is
 *      unbounded (no counter) — unchanged SRD-style behaviour.
 *
 * Uses the store-injection seam (no mock.module()). The injected store snapshot
 * is forwarded to useSoftLinks, so SoftLinks + crawler resolution run through
 * the same stub.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { PilotSheet } from '../PilotSheet'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import type { useEntityStore } from '../../../stores/entityStore'

const SNIPER_NAME = 'Custom Sniper Rifle'
let SNIPER_ID = ''

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  const sniper = SalvageUnionReference.Equipment.all().find((e) => e.name === SNIPER_NAME)
  if (!sniper) throw new Error(`Fixture setup: equipment "${SNIPER_NAME}" not found in reference`)
  SNIPER_ID = sniper.id
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePilot(overrides?: Partial<Pilot>): Pilot {
  return {
    id: 'pilot-crawler-level-1',
    schemaVersion: 1,
    name: 'Zara Quinn',
    callsign: 'Hex',
    classRef: 'scavenger',
    abilities: [],
    equipment: [SNIPER_ID],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeCrawler(overrides?: Partial<Crawler>): Crawler {
  return {
    id: 'crawler-1',
    schemaVersion: 1,
    name: 'The Wanderer',
    techLevel: 'tech-3',
    systems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Store stub with mutable pilot + optional crawler + softLinks. get() returns
 * fresh state after update so toggles/edits read back.
 */
function makeStore(opts: {
  pilot: Pilot
  crawler?: Crawler
  softLinks?: SoftLink[]
  updateSpy?: ReturnType<typeof mock>
}) {
  let pilot = opts.pilot
  const crawler = opts.crawler ?? null
  const softLinks = opts.softLinks ?? []

  const updateMock =
    opts.updateSpy ??
    mock(async (_type: string, _id: string, patch: Partial<Pilot>) => {
      pilot = { ...pilot, ...patch }
      return pilot
    })

  const storeState = {
    pilots: [pilot],
    mechs: [],
    crawlers: crawler ? [crawler] : [],
    softLinks,
    hydrated: { pilots: true, mechs: false, crawlers: !!crawler, softLinks: true },
    hydrate: mock(async () => {}),
    list: mock(() => [pilot]),
    get: mock((type: string, id: string) => {
      if (type === 'pilot') return id === pilot.id ? pilot : null
      if (type === 'crawler') return crawler && id === crawler.id ? crawler : null
      return null
    }),
    create: mock(async () => pilot),
    update: updateMock,
    delete: mock(async () => {}),
  }
  const store = (() => storeState) as unknown as typeof useEntityStore
  return { store, updateMock }
}

function pilotToCrawlerLink(pilotId: string, crawlerId: string): SoftLink {
  return {
    id: `link-${pilotId}-${crawlerId}`,
    from: { type: 'pilot', id: pilotId },
    to: { type: 'crawler', id: crawlerId },
    type: 'pilot-to-crawler',
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PilotSheet — Crawler Level (Slice E)', () => {
  test('unlinked pilot: shows an editable Crawler Level field that persists', async () => {
    const pilot = makePilot({ crawlerLevel: 2 })
    const { store, updateMock } = makeStore({ pilot })
    render(<PilotSheet pilot={pilot} store={store} />)

    const field = screen.getByLabelText('Edit Crawler Level')
    expect(field).toBeTruthy()

    // Click to edit, type a new value, commit with Enter.
    await act(async () => {
      fireEvent.click(field)
    })
    const input = screen.getByLabelText('Edit Crawler Level') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: '4' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(updateMock).toHaveBeenCalledWith('pilot', pilot.id, { crawlerLevel: 4 })
  })

  test('linked crawler: shows the crawler techLevel read-only (no manual edit field)', () => {
    const pilot = makePilot({ crawlerLevel: 2 })
    const crawler = makeCrawler({ techLevel: 'tech-5' })
    const { store } = makeStore({
      pilot,
      crawler,
      softLinks: [pilotToCrawlerLink(pilot.id, crawler.id)],
    })
    render(<PilotSheet pilot={pilot} store={store} />)

    // No manual edit affordance when a crawler is associated.
    expect(screen.queryByLabelText('Edit Crawler Level')).toBeNull()
    // Effective level comes from the crawler (5), not the manual fallback (2),
    // and the source note references the crawler.
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText(/from associated crawler/i)).toBeTruthy()
  })

  test('Modification cap resolves to the effective level (counter appears)', () => {
    // Linked crawler at tech-3 → the Modification choice cap is 3, surfaced as a
    // "0/3" counter on the choice group.
    const pilot = makePilot()
    const crawler = makeCrawler({ techLevel: 'tech-3' })
    const { store } = makeStore({
      pilot,
      crawler,
      softLinks: [pilotToCrawlerLink(pilot.id, crawler.id)],
    })
    render(<PilotSheet pilot={pilot} store={store} />)

    expect(screen.getByText('0/3')).toBeTruthy()
  })

  test('no crawler + no manual level: Modification cap is unbounded (no counter)', () => {
    const pilot = makePilot({ crawlerLevel: undefined })
    const { store } = makeStore({ pilot })
    render(<PilotSheet pilot={pilot} store={store} />)

    // The Modification group renders, but with no resolved cap there is no
    // "n/max" counter (unchanged SRD-style behaviour).
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull()
  })
})
