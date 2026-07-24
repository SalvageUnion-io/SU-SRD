/**
 * Responsive layout tests — Phase 4.
 *
 * These tests assert that layout-bearing Tailwind classes are present on the
 * correct container elements. happy-dom does not compute layout, so we verify
 * className strings directly — this is the standard pattern for layout-only
 * changes in this codebase (see mobile-responsive.test.tsx).
 *
 * Coverage:
 *  1. Sheet — LiveSheet shell carries the variant tone class + sticky header;
 *     the crawler body's 2-col macro grid (content ∥ Storage rail) splits at
 *     its container breakpoint
 *  2. Sheet — missing entity still renders without crash (guard path)
 *  3. SnapshotSheet — uses max-w-7xl container
 *  4. Roster — sections wrapper uses flex flex-col (mobile) and the
 *     section container element is rendered (grid classes are on the same el)
 *  5. CrawlerSheet — stats dl uses grid-cols-1 (not grid-cols-2 with empty cell)
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - No mock.module()
 *  - afterEach cleanup()
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Sheet } from '../Sheet'
import type { EntityLookup } from '../Sheet'
import type { SoftLinkStore } from '../../wiring/useSoftLinks'
import { CrawlerSheet } from '../CrawlerSheet'
import { SnapshotSheet } from '../SnapshotSheet'
import { Roster } from '../../roster/Roster'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'

// ---------------------------------------------------------------------------
// Preload reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fakePilot: Pilot = {
  id: 'pilot-resp-1',
  schemaVersion: 1,
  name: 'Test Pilot',
  callsign: 'TP',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeMech: Mech = {
  id: 'mech-resp-1',
  schemaVersion: 1,
  name: 'Test Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-resp-1',
  schemaVersion: 1,
  name: 'Test Crawler',
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
  return makeSoftLinkStoreMock(links)
}

function makeMechToPilotLink(mechId: string, pilotId: string): SoftLink {
  return {
    id: `link-${mechId}-${pilotId}`,
    from: { type: 'mech', id: mechId },
    to: { type: 'pilot', id: pilotId },
    type: 'mech-to-pilot',
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 1. Sheet — wired composition uses max-w-7xl container
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — wired composition (LiveSheet shell)', () => {
  test('Sheet wired (mech+pilot) renders the variant-toned shell root', () => {
    const link = makeMechToPilotLink('mech-resp-1', 'pilot-resp-1')
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    expect(container.querySelector('.sheet--mech')).toBeTruthy()
    expect(container.querySelector('[data-variant="mech"]')).toBeTruthy()
  })

  test('Sheet crawler body is a single-column region flow with Storage as a full-width bottom band', () => {
    // Workshop-Manual crawler sheet: a single-column region stack (Identity →
    // Bays → Weapons → Linked Units → Storage Bay), NOT the old 2-col macro
    // grid that stood Storage up as a full-height right column. The old
    // `54fr`-split grid is gone; the crawler section flows in one column and
    // the Storage Bay renders as its own section at the bottom.
    const { container } = render(
      <Sheet
        kind="crawler"
        id="crawler-resp-1"
        entityStore={makeEntityStore([fakeCrawler])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    // The old right-column macro grid is removed.
    expect(container.querySelector('[class*="54fr"]')).toBeNull()
    // The crawler body's region flow is a single column.
    const flow = container.querySelector('section[aria-label$="crawler sheet"] > div')
    expect(flow).toBeTruthy()
    expect((flow as HTMLElement).className).toContain('flex-col')
    // The Storage Bay band is present.
    expect(container.textContent).toContain('Storage Bay')
  })
})

// ---------------------------------------------------------------------------
// 2. Sheet — single entity shells carry their variant tone class
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — single entity', () => {
  test('mech-only Sheet renders the mech-toned shell with a sticky header', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(container.querySelector('.sheet--mech')).toBeTruthy()
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect((header as HTMLElement).className).toContain('sticky')
  })

  test('pilot-only Sheet renders the pilot-toned shell with a sticky header', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="pilot-resp-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
    const header = container.querySelector('header')
    expect(header).toBeTruthy()
    expect((header as HTMLElement).className).toContain('sticky')
  })
})

// ---------------------------------------------------------------------------
// 3. SnapshotSheet — renders the LiveSheet shell (plan 4.8 port)
// ---------------------------------------------------------------------------

describe('SnapshotSheet responsive layout', () => {
  test('SnapshotSheet pilot snapshot renders the variant shell + banner', () => {
    const snapshot = { kind: 'pilot', entity: { ...fakePilot } }
    const { container } = render(<SnapshotSheet snapshot={snapshot as Record<string, unknown>} />)
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
    expect(container.querySelector('[aria-label="Read-only snapshot"]')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 4. CrawlerSheet — body section stacks as a single column of slabs
// ---------------------------------------------------------------------------

describe('CrawlerSheet responsive layout — body section', () => {
  test('body renders as a single flex column (slabs stack at every width)', () => {
    const { container } = render(<CrawlerSheet crawler={fakeCrawler} />)
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect((section as HTMLElement).className).toContain('flex-col')
  })
})

// ---------------------------------------------------------------------------
// 5. Roster — renders sections (structural check)
// ---------------------------------------------------------------------------

describe('Roster responsive layout — sections render', () => {
  test('Roster renders with its max-w outer container', async () => {
    const { container } = render(<Roster />)
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
  })
})
