/**
 * PilotSheet — Crawler Level (Slice E) tests.
 *
 * The "Crawler Level" slab UI (manual-fallback editor + linked-crawler
 * readout) was dropped from the pilot sheet body in the redesign poster
 * conformance pass (D6, #410) — it has no poster counterpart. What survives
 * is the underlying SCALING SOURCE: `resolveEffectiveCrawlerLevel` still
 * feeds choice caps (e.g. the Modification choice) regardless of whether a
 * crawler-level control renders anywhere.
 *
 * Asserts that:
 *   1. The dropped manual-fallback editor and linked-crawler readout no
 *      longer render on the pilot sheet body (#410).
 *   2. The effective level still feeds the Modification choice cap: the
 *      `n/max` counter resolves to the effective level from a linked crawler.
 *   3. With neither a crawler nor a manual level, the Modification cap floors at
 *      the equipment's base tech level (Custom Sniper Rifle is TL1 → 0/1) — a
 *      granted item is never below its own tech level.
 *
 * Uses the store-injection seam (no mock.module()). The injected store snapshot
 * is forwarded to useSoftLinks, so SoftLinks + crawler resolution run through
 * the same stub.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
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

describe('PilotSheet — Crawler Level slab dropped (redesign D6, #410)', () => {
  test('no manual-fallback editor renders, linked or not', () => {
    const pilot = makePilot({ crawlerLevel: 2 })
    const { store } = makeStore({ pilot })
    render(<PilotSheet pilot={pilot} store={store} />)

    expect(screen.queryByLabelText('Edit Crawler Level')).toBeNull()
    expect(screen.queryByText('Crawler Level')).toBeNull()
  })

  test('no linked-crawler readout renders on the sheet body', () => {
    const pilot = makePilot({ crawlerLevel: 2 })
    const crawler = makeCrawler({ techLevel: 'tech-5' })
    const { store } = makeStore({
      pilot,
      crawler,
      softLinks: [pilotToCrawlerLink(pilot.id, crawler.id)],
    })
    render(<PilotSheet pilot={pilot} store={store} />)

    expect(screen.queryByLabelText('Edit Crawler Level')).toBeNull()
    expect(screen.queryByText(/from associated crawler/i)).toBeNull()
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

  test('no crawler + no manual level: Modification cap floors at the base TL (0/1)', () => {
    const pilot = makePilot({ crawlerLevel: undefined })
    const { store } = makeStore({ pilot })
    render(<PilotSheet pilot={pilot} store={store} />)

    // Custom Sniper Rifle is TL1 (a granted item with no inherent rules tech
    // level). Its effective tech level floors at that base, so with no crawler
    // you still get one modification — a "0/1" counter, not unbounded.
    expect(screen.getByText('0/1')).toBeTruthy()
  })
})
