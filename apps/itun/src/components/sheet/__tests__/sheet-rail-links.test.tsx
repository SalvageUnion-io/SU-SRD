/**
 * Replacement coverage for the deleted route tests (cross-links.test.tsx +
 * detail-routes.test.tsx), reframed onto the single view+edit Sheet surface:
 *
 *   1. Cross-links on the rail — a wired sheet renders rail chips that link to
 *      its wired counterparts (`/sheet/<kind>/<id>`). Anchors are asserted
 *      directly (no RouterProvider → AppLink degrades to plain `<a href>`).
 *   2. Entity-not-found — an id absent from the store renders the styled
 *      "{kind} not found" surface with a "Back to Roster" exit link.
 *   3. Rail unlink availability — per the unified edit language the linked
 *      row's Delete control is always available on editable sheets and
 *      never rendered on read-only (snapshot) sheets.
 *
 * Fixture/store setup mirrors Sheet-topbar-segments.test.tsx.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { Mech } from '../../../lib/schemas/mech'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { useEntityStore } from '../../../stores/entityStore'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import type { EntityLookup } from '../Sheet'
import { Sheet } from '../Sheet'

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
  return makeEntityLookupMock(entities)
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  // The create mock is unused here; cast is safe — these tests never assign()
  return makeSoftLinkStoreMock(links)
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

/**
 * The linked-unit slots render the roster's `EntityRow`, whose View link is
 * labelled "View" on every row — so a link is targeted by its DESTINATION here
 * rather than by an accessible name that no longer distinguishes rows. That is
 * what these tests were ever asserting: that the cross-link points at the right
 * sheet.
 */
function linkTo(href: string): HTMLElement {
  const match = screen.getAllByRole('link').find((a) => a.getAttribute('href') === href)
  if (!match) throw new Error(`no link to ${href}`)
  return match
}

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
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()
    expect(linkTo('/sheet/crawler/crawler-1')).toBeTruthy()
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
    expect(linkTo('/sheet/pilot/pilot-1')).toBeTruthy()
  })

  test('wired crawler sheet links to its pilots and docked mechs', () => {
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
    expect(linkTo('/sheet/pilot/pilot-1')).toBeTruthy()
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. Entity-not-found path
// ---------------------------------------------------------------------------

describe('Sheet — entity not found', () => {
  test('unknown id renders the not-found heading + back-to-Roster link', () => {
    render(
      <Sheet
        kind="pilot"
        id="does-not-exist"
        entityStore={makeEntityStore([])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(screen.getByRole('heading', { name: /pilot not found/i })).toBeTruthy()

    const back = screen.getByRole('link', { name: /back to roster/i })
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
// 3. Unlinking is gated behind edit mode (EntityRow's Delete)
// ---------------------------------------------------------------------------

describe('Sheet — rail unlink availability (unified edit language)', () => {
  test('unlink is always available on an editable sheet, never on read-only', () => {
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

    // Sanity: the wired mech row is present.
    expect(linkTo('/sheet/mech/mech-1')).toBeTruthy()

    // Collection add/remove is ALWAYS available on editable sheets — no edit
    // mode gate (redesign archetype B).
    expect(screen.getByRole('button', { name: /^Delete Iron Fist$/i })).toBeTruthy()
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
    expect(screen.queryByRole('button', { name: /^Delete Iron Fist$/i })).toBeNull()
  })
})
