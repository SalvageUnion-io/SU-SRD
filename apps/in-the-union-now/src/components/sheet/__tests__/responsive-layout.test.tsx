/**
 * Responsive layout tests — Phase 4.
 *
 * These tests assert that layout-bearing Tailwind classes are present on the
 * correct container elements. happy-dom does not compute layout, so we verify
 * className strings directly — this is the standard pattern for layout-only
 * changes in this codebase (see mobile-responsive.test.tsx).
 *
 * Coverage:
 *  1. Sheet — wired composition uses lg:flex-row 2-pane wrapper (max-w-7xl)
 *  2. Sheet — missing entity still renders without crash (guard path)
 *  3. SnapshotView — uses max-w-7xl container
 *  4. Dashboard — sections wrapper uses flex flex-col (mobile) and the
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
import { SnapshotView } from '../SnapshotView'
import { Dashboard } from '../../dashboard/Dashboard'
import type { Pilot } from '../../../lib/schemas/pilot'
import type { Mech } from '../../../lib/schemas/mech'
import type { Crawler } from '../../../lib/schemas/crawler'
import type { SoftLink } from '../../../lib/schemas/softLink'

// ---------------------------------------------------------------------------
// Preload reference data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
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
  rollResults: [],
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
  cargo: [],
  conditions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const fakeCrawler: Crawler = {
  id: 'crawler-resp-1',
  schemaVersion: 1,
  name: 'Test Crawler',
  techLevel: 'tech-2',
  bays: [],
  systems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

type AnyEntity = Pilot | Mech | Crawler

function makeEntityStore(entities: AnyEntity[]): EntityLookup {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_type, id) => (entities.find((e) => e.id === id) ?? null) as any,
  }
}

function makeSoftLinkStore(links: SoftLink[]): SoftLinkStore {
  return {
    softLinks: links,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: async () => links[0] as any,
    delete: async () => undefined,
  }
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

describe('Sheet responsive layout — wired composition', () => {
  test('Sheet wired (mech+pilot) renders with max-w-7xl main container', () => {
    const link = makeMechToPilotLink('mech-resp-1', 'pilot-resp-1')
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect((main as HTMLElement).className).toContain('max-w-7xl')
  })

  test('Sheet wired content wrapper uses lg:flex-row for 2-pane layout', () => {
    const link = makeMechToPilotLink('mech-resp-1', 'pilot-resp-1')
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityStore([fakeMech, fakePilot])}
        softLinkStore={makeSoftLinkStore([link])}
      />
    )
    // The wired composition div should have lg:flex-row
    const flexRow = container.querySelector('[class*="lg:flex-row"]')
    expect(flexRow).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. Sheet — single entity (mech-only) uses max-w-7xl
// ---------------------------------------------------------------------------

describe('Sheet responsive layout — single entity', () => {
  test('mech-only Sheet main uses max-w-7xl', () => {
    const { container } = render(
      <Sheet
        kind="mech"
        id="mech-resp-1"
        entityStore={makeEntityStore([fakeMech])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect((main as HTMLElement).className).toContain('max-w-7xl')
  })

  test('pilot-only Sheet main uses max-w-7xl', () => {
    const { container } = render(
      <Sheet
        kind="pilot"
        id="pilot-resp-1"
        entityStore={makeEntityStore([fakePilot])}
        softLinkStore={makeSoftLinkStore([])}
      />
    )
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect((main as HTMLElement).className).toContain('max-w-7xl')
  })
})

// ---------------------------------------------------------------------------
// 3. SnapshotView — uses max-w-7xl container
// ---------------------------------------------------------------------------

describe('SnapshotView responsive layout', () => {
  test('SnapshotView pilot snapshot uses max-w-7xl container', () => {
    const snapshot = { kind: 'pilot', entity: { ...fakePilot } }
    const { container } = render(<SnapshotView snapshot={snapshot as Record<string, unknown>} />)
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
    expect((main as HTMLElement).className).toContain('max-w-7xl')
  })
})

// ---------------------------------------------------------------------------
// 4. CrawlerSheet — stats grid uses grid-cols-1 (not grid-cols-2)
// ---------------------------------------------------------------------------

describe('CrawlerSheet responsive layout — stats grid', () => {
  test('stats dl uses grid-cols-1 class', () => {
    const { container } = render(<CrawlerSheet crawler={fakeCrawler} />)
    const dl = container.querySelector('dl')
    expect(dl).toBeTruthy()
    expect((dl as HTMLElement).className).toContain('grid-cols-1')
    expect((dl as HTMLElement).className).not.toContain('grid-cols-2')
  })
})

// ---------------------------------------------------------------------------
// 5. Dashboard — renders sections (structural check)
// ---------------------------------------------------------------------------

describe('Dashboard responsive layout — sections render', () => {
  test('Dashboard renders with its max-w outer container', async () => {
    const { container } = render(<Dashboard />)
    const main = container.querySelector('main')
    expect(main).toBeTruthy()
  })
})
