/**
 * DowntimeControl — the one-click Downtime runner (design-review R-2;
 * Core Book p.227-228).
 *
 * Coverage:
 *   1. Applying the full checklist writes one patch per crew entity —
 *      mech restore/repair + pilot heal/train — scoped over the SoftLink
 *      graph.
 *   2. A Damaged Mech Bay surfaces the p.221 advisory and blocks the mech
 *      restore write (pilot bookkeeping still applies).
 *   3. An unlinked crawler explains itself instead of applying nothing.
 *
 * Uses the store-injection seam + REAL reference data — same pattern as
 * CrawlerEconomyControl.test.tsx. NO mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { DowntimeControl } from '../DowntimeControl'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import type { useEntityStore } from '../../../stores/entityStore'
import { must } from '../../__tests__/must'

beforeAll(async () => {
  await SalvageUnionReference.preload([
    'chassis',
    'systems',
    'modules',
    'equipment',
    'crawler-bays',
    'crawler-tech-levels',
  ])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = '2026-07-01T00:00:00.000Z'

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-dt-1',
    schemaVersion: 1,
    name: 'Ada',
    callsign: 'Wrench',
    classRef: 'engineer',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return {
    id: 'mech-dt-1',
    schemaVersion: 1,
    name: 'Iron Fist',
    chassisRef: 'Mule',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-dt-1',
    schemaVersion: 1,
    name: 'Tin Lizzy',
    techLevel: 'tech-3',
    systems: [],
    crawlerBays: [{ bayRef: 'Mech Bay' }, { bayRef: 'Med Bay' }],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function crewLinks(pilot: Pilot, mech: Mech, crawler: Crawler): SoftLink[] {
  return [
    {
      id: 'link-1',
      type: 'pilot-to-crawler',
      from: { type: 'pilot', id: pilot.id },
      to: { type: 'crawler', id: crawler.id },
      createdAt: NOW,
    },
    {
      id: 'link-2',
      type: 'mech-to-pilot',
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      createdAt: NOW,
    },
  ]
}

function makeStubStore({
  crawler,
  pilots = [],
  mechs = [],
  links = [],
}: {
  crawler: Crawler
  pilots?: Pilot[]
  mechs?: Mech[]
  links?: SoftLink[]
}) {
  const update = mock<
    (type: string, id: string, patch: Partial<Crawler | Mech | Pilot>) => Promise<Crawler>
  >(async () => crawler)
  const storeState = {
    pilots,
    mechs,
    crawlers: [crawler],
    softLinks: links,
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
    hydrate: mock(async () => {}),
    list: mock((type: string) => (type === 'pilot' ? pilots : type === 'mech' ? mechs : [crawler])),
    get: mock((type: string, id: string) => {
      if (type === 'crawler' && id === crawler.id) return crawler
      if (type === 'pilot') return pilots.find((p) => p.id === id) ?? null
      if (type === 'mech') return mechs.find((m) => m.id === id) ?? null
      return null
    }),
    create: mock(async () => crawler),
    update,
    updateCrawlerBay: mock(async () => crawler),
    delete: mock(async () => {}),
  }
  return { store: (() => storeState) as unknown as typeof useEntityStore, update }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DowntimeControl (p.227-228)', () => {
  test('applies the checklist to the crew: mech restore + pilot train in one pass', async () => {
    const crawler = makeCrawler()
    const pilot = makePilot({ trainingPoints: 2 })
    const mech = makeMech({ currentSP: 2, currentEP: 1, currentHeat: 4 })
    const { store, update } = makeStubStore({
      crawler,
      pilots: [pilot],
      mechs: [mech],
      links: crewLinks(pilot, mech, crawler),
    })
    render(<DowntimeControl crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Downtime' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply Downtime' }))
    await screen.findByRole('status')

    expect(update).toHaveBeenCalledTimes(2)
    const [mechCall, pilotCall] = update.mock.calls as [
      [string, string, Partial<Mech>],
      [string, string, Partial<Pilot>],
    ]
    expect(mechCall[0]).toBe('mech')
    expect(mechCall[1]).toBe(mech.id)
    expect(mechCall[2].currentHeat).toBe(0)
    expect(mechCall[2].currentSP).toBeGreaterThan(2)
    expect(pilotCall[0]).toBe('pilot')
    expect(pilotCall[1]).toBe(pilot.id)
    expect(pilotCall[2].trainingPoints).toBe(3)

    // The Upkeep prompt closes the loop (5× Tech 3 Scrap — rules C3).
    expect(screen.getByText(/Upkeep: 5× Tech 3 Scrap/)).toBeTruthy()
  })

  test('a Damaged Mech Bay blocks the mech restore and says why (p.221)', async () => {
    const crawler = makeCrawler({
      crawlerBays: [{ bayRef: 'Mech Bay', condition: 'damaged' }, { bayRef: 'Med Bay' }],
    })
    const pilot = makePilot({ trainingPoints: 0 })
    const mech = makeMech({ currentSP: 2 })
    const { store, update } = makeStubStore({
      crawler,
      pilots: [pilot],
      mechs: [mech],
      links: crewLinks(pilot, mech, crawler),
    })
    render(<DowntimeControl crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Downtime' }))
    expect(await screen.findByText(/Mech Bay is Damaged/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Apply Downtime' }))
    await screen.findByRole('status')

    // Only the pilot writes — the mech's restore was gated off.
    expect(update).toHaveBeenCalledTimes(1)
    expect(must(update.mock.calls[0])[0]).toBe('pilot')
  })

  test('an unlinked crawler explains the empty scope instead of offering Apply', async () => {
    const crawler = makeCrawler()
    const { store, update } = makeStubStore({ crawler })
    render(<DowntimeControl crawler={crawler} store={store} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Downtime' }))
    expect(await screen.findByText(/No crew is linked/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply Downtime' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
