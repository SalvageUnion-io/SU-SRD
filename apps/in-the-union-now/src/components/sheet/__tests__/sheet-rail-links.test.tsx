/**
 * Replacement coverage for the deleted route tests (cross-links.test.tsx +
 * detail-routes.test.tsx), reframed onto the single view+edit Sheet surface:
 *
 *   1. Cross-links on the rail — a wired sheet renders rail chips that link to
 *      its wired counterparts (`/sheet/<kind>/<id>`). Anchors are asserted
 *      directly (no RouterProvider → AppLink degrades to plain `<a href>`).
 *   2. Entity-not-found — an id absent from the store renders the styled
 *      "{kind} not found" surface with a "Back to dashboard" exit link.
 *   3. Rail Unassign availability — per the unified edit language the rail
 *      chip's ✕ Unassign control is always available on editable sheets and
 *      never rendered on read-only (snapshot) sheets.
 *
 * Fixture/store setup mirrors Sheet-topbar-segments.test.tsx.
 */

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import { useEntityStore } from '../../../stores/entityStore'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
  // Reset the live store so the Unassign test (which seeds softLinks into the
  // real store to derive the link id) never leaks into other tests.
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
})

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-1',
  schemaVersion: 1,
  name: 'Iron Fist',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-1',
  schemaVersion: 1,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return {
    // EntityLookup's conditional return type can't be satisfied without a cast
    get: ((_type: unknown, id: string) =>
      entities.find((e) => e.id === id) ?? null) as unknown as EntityLookup['get'],
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // The create mock is unused here; cast is safe — these tests never assign()
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

const mechToPilot = makeLink('link-1', 'mech', 'mech-1', 'pilot', 'pilot-1', 'mech-to-pilot')
const pilotToCrawler = makeLink(
  'link-2',
  'pilot',
  'pilot-1',
  'crawler',
  'crawler-1',
  'pilot-to-crawler'
)

// ---------------------------------------------------------------------------
// 1. Cross-links on the rail
// ---------------------------------------------------------------------------

describe('Sheet — rail cross-links', () => {
  test('wired pilot sheet links to its assigned mech and home crawler', () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilot, pilotToCrawler])}
      />
    )
    // The rail chip anchor carries a distinctive "<role>: <name> — open sheet"
    // aria-label, so it targets the rail chip (not the mobile segment switch,
    // which links to the same hrefs).
    const mechChip = screen.getByRole('link', { name: /Assigned Mech: Iron Fist/i })
    expect(mechChip.getAttribute('href')).toBe('/sheet/mech/mech-1')

    const crawlerChip = screen.getByRole('link', { name: /Home Crawler: Iron Tortoise/i })
    expect(crawlerChip.getAttribute('href')).toBe('/sheet/crawler/crawler-1')
  })

  test('wired mech sheet links to its assigned pilot', () => {
    render(
      <Sheet
        kind="mech"
        id="mech-1"
        entityStore={makeEntityStore([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStore([mechToPilot])}
      />
    )
    const pilotChip = screen.getByRole('link', { name: /Assigned Pilot: Yara Voss/i })
    expect(pilotChip.getAttribute('href')).toBe('/sheet/pilot/pilot-1')
  })

  test('wired crawler sheet links to its lead pilot and docked mech', () => {
    render(
      <Sheet
        kind="crawler"
        id="crawler-1"
        entityStore={makeEntityStore([fakePilot, fakeMech, fakeCrawler])}
        softLinkStore={makeSoftLinkStore([mechToPilot, pilotToCrawler])}
      />
    )
    // Lead pilot = first pilot wired to the crawler; docked mech = that lead
    // pilot's assigned mech (two-hop resolution in composition.ts).
    const pilotChip = screen.getByRole('link', { name: /Lead Pilot: Yara Voss/i })
    expect(pilotChip.getAttribute('href')).toBe('/sheet/pilot/pilot-1')

    const mechChip = screen.getByRole('link', { name: /Docked Mech: Iron Fist/i })
    expect(mechChip.getAttribute('href')).toBe('/sheet/mech/mech-1')
  })
})

// ---------------------------------------------------------------------------
// 2. Entity-not-found path
// ---------------------------------------------------------------------------

describe('Sheet — entity not found', () => {
  test('unknown id renders the not-found heading + back-to-dashboard link', () => {
    render(
      <Sheet
        kind="pilot"
        id="does-not-exist"
        entityStore={makeEntityStore([])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('heading', { name: /pilot not found/i })).toBeTruthy()

    const back = screen.getByRole('link', { name: /back to dashboard/i })
    expect(back.getAttribute('href')).toBe('/')
  })

  test('not-found path uses the viewed kind in the heading', () => {
    render(
      <Sheet
        kind="mech"
        id="does-not-exist"
        entityStore={makeEntityStore([])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('heading', { name: /mech not found/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 3. Rail Unassign is gated behind edit mode
// ---------------------------------------------------------------------------

describe('Sheet — rail Unassign availability (unified edit language)', () => {
  test('Unassign is always available on an editable sheet, never on read-only', () => {
    // The rail's Unassign link id is derived from the LIVE store's softLinks
    // (composition only exposes resolved entities), so seed the real store —
    // composition + PublishButton still read the injected snapshots.
    useEntityStore.setState({
      softLinks: [mechToPilot],
      hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: true },
    })

    const { unmount } = render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStore([mechToPilot])}
      />
    )

    // Sanity: the wired mech chip is present.
    expect(screen.getByRole('link', { name: /Assigned Mech: Iron Fist/i })).toBeTruthy()

    // Collection add/remove is ALWAYS available on editable sheets — no edit
    // mode gate (redesign archetype B).
    expect(screen.getByRole('button', { name: /unassign/i })).toBeTruthy()
    unmount()

    // Read-only (snapshot) sheets never expose the destructive control.
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityStore([fakePilot, fakeMech])}
        softLinkStore={makeSoftLinkStore([mechToPilot])}
        readOnly
      />
    )
    expect(screen.queryByRole('button', { name: /unassign/i })).toBeNull()
  })
})
