/**
 * Sheet — crawler-wired composition mode rendering (#244).
 *
 * Covers three composition scenarios NOT yet asserted by Sheet.test.tsx or
 * sheet-smoke.test.tsx in terms of sub-sheet content visibility:
 *
 *   A. pilot + crawler (no mech) — both PilotSheet and CrawlerSheet render
 *   B. full wired: mech + pilot + crawler — all three sub-sheets render
 *   C. crawler + pilots (wired) — CrawlerSheet renders with wired pilot names
 *
 * These complement the rail-empty tests in Sheet.test.tsx (which verify
 * stand-ins appear/disappear) by asserting entity content is actually rendered.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module().
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'crawler-tech-levels'])
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fake entities
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-comp-1',
  schemaVersion: 1,
  name: 'Desta Oryn',
  callsign: 'Delta',
  classRef: 'mechanic',
  abilities: [],
  equipment: [],
  motto: 'One wrench.',
  keepsake: 'Nothing.',
  appearance: 'Scarred.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakePilot2: Pilot = {
  id: 'pilot-comp-2',
  schemaVersion: 1,
  name: 'Hann Vex',
  callsign: 'Echo',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Move fast.',
  keepsake: 'A token.',
  appearance: 'Wiry.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-comp-1',
  schemaVersion: 1,
  name: 'Dust Hammer',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-comp-1',
  schemaVersion: 1,
  name: 'The Hive',
  techLevel: 'tech-2',
  systems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Store / link factories
// ---------------------------------------------------------------------------

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return {
    get: ((_type: unknown, id: string) =>
      entities.find((e) => e.id === id) ?? null) as unknown as EntityLookup['get'],
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  const createMock = mock(async () => links[0]) as unknown as SoftLinkStore['create']
  return {
    softLinks: links,
    create: createMock,
    delete: mock(async () => undefined),
  }
}

function makeLink(
  id: string,
  fromType: 'mech' | 'pilot' | 'crawler',
  fromId: string,
  toType: 'mech' | 'pilot' | 'crawler',
  toId: string,
  type: SoftLink['type']
): SoftLink {
  return {
    id,
    from: { type: fromType, id: fromId },
    to: { type: toType, id: toId },
    type,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Scenario A — pilot + crawler (no mech)
// kind=pilot with pilot-to-crawler outgoing link, no mech-to-pilot link
// ---------------------------------------------------------------------------

describe('Sheet — pilot+crawler wired composition (no mech)', () => {
  const pilotToCrawlerLink = makeLink(
    'link-pc',
    'pilot',
    'pilot-comp-1',
    'crawler',
    'crawler-comp-1',
    'pilot-to-crawler'
  )

  test('PilotSheet content (pilot name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('wired toggle reads Wired', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByRole('switch', { name: /wired/i })).toBeTruthy()
  })

  test('mech RailEmpty renders (no mech is wired)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByText(/No mech assigned/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Scenario B — full wired: mech + pilot + crawler
// kind=pilot with both mech-to-pilot incoming AND pilot-to-crawler outgoing
// ---------------------------------------------------------------------------

describe('Sheet — full wired (mech+pilot+crawler)', () => {
  const mechToPilotLink = makeLink(
    'link-mp',
    'mech',
    'mech-comp-1',
    'pilot',
    'pilot-comp-1',
    'mech-to-pilot'
  )
  const pilotToCrawlerLink = makeLink(
    'link-pc',
    'pilot',
    'pilot-comp-1',
    'crawler',
    'crawler-comp-1',
    'pilot-to-crawler'
  )

  test('PilotSheet content (pilot name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('MechSheet content (mech name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Dust Hammer/).length).toBeGreaterThan(0)
  })

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('wired toggle reads Wired', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getByRole('switch', { name: /wired/i })).toBeTruthy()
  })

  test('no stand-ins rendered (all three entities are wired)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/No mech assigned/)).toBeNull()
    expect(screen.queryByText(/No pilot assigned/)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Scenario C — crawler + pilots (wired)
// kind=crawler with pilot-to-crawler incoming links from multiple pilots
// ---------------------------------------------------------------------------

describe('Sheet — crawler+pilots wired composition', () => {
  const pilot1ToCrawlerLink = makeLink(
    'link-p1c',
    'pilot',
    'pilot-comp-1',
    'crawler',
    'crawler-comp-1',
    'pilot-to-crawler'
  )
  const pilot2ToCrawlerLink = makeLink(
    'link-p2c',
    'pilot',
    'pilot-comp-2',
    'crawler',
    'crawler-comp-1',
    'pilot-to-crawler'
  )

  test('CrawlerSheet content (crawler name) is visible', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/The Hive/).length).toBeGreaterThan(0)
  })

  test('lead pilot (first wired) appears in the rail chip', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Desta Oryn/).length).toBeGreaterThan(0)
  })

  test('non-lead pilots do not render — the rail carries only the lead (design §4.4)', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/Hann Vex/)).toBeNull()
  })

  test('wired toggle reads Wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getByRole('switch', { name: /wired/i })).toBeTruthy()
  })

  test('lead-pilot RailEmpty not rendered when pilots are wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.queryByText(/No lead pilot set/)).toBeNull()
  })
})
