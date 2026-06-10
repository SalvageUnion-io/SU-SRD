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
 * These complement the MechStandIn tests in Sheet.test.tsx (which verify
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
  await SalvageUnionReference.preload(['chassis'])
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
  rollResults: [],
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
  rollResults: [],
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (entities.find((e) => e.id === id) ?? null) as any,
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMock = mock(async () => links[0]) as any
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

  test('composition badge shows "Wired"', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Wired')).toBeTruthy()
  })

  test('MechStandIn renders (no mech is wired)', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([pilotToCrawlerLink])}
      />
    )
    expect(screen.getByLabelText('No mech assigned')).toBeTruthy()
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

  test('composition badge shows "Wired"', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-comp-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilotLink, pilotToCrawlerLink])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Wired')).toBeTruthy()
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
    expect(screen.queryByLabelText('No mech assigned')).toBeNull()
    expect(screen.queryByLabelText('No pilot assigned')).toBeNull()
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

  test('first wired pilot name is visible in CrawlerSheet', () => {
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

  test('second wired pilot name is visible in CrawlerSheet', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getAllByText(/Hann Vex/).length).toBeGreaterThan(0)
  })

  test('composition badge shows "Wired"', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.getByLabelText('Composition mode: Wired')).toBeTruthy()
  })

  test('CrawlerPilotsStandIn not rendered when pilots are wired', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-comp-1"
        entityStore={makeEntityStore([fakeCrawler, fakePilot, fakePilot2])}
        softLinkStore={makeSoftLinkStore([pilot1ToCrawlerLink, pilot2ToCrawlerLink])}
      />
    )
    expect(screen.queryByLabelText('No pilots assigned')).toBeNull()
  })
})
