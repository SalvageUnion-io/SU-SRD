/**
 * Cross-link tests for the pilot↔mech↔crawler soft-link triad.
 *
 * Proves the detail routes render CLICKABLE navigation links (not plain text)
 * for their soft-linked neighbours, resolving the linked entity's name:
 *   - Pilot detail → its crawler (outgoing) and its mechs (incoming)
 *   - Mech detail  → its pilot (outgoing)
 * (Crawler → pilots is covered by the route's existing "Assigned Pilots" list.)
 *
 * The page bodies are rendered via their exported `*DetailInner({ id })` seams
 * under a MINIMAL memory router — enough context for `<Link>` href resolution
 * without booting the full app tree. SRD data is preloaded once so PilotSheet's
 * sub-controls resolve cleanly; entities are seeded with empty loadouts so no
 * ReferenceEntityDisplay subtree fires an SRD lookup.
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument()
 *   - No mock.module()
 *   - hydrated flags set true so the query hooks don't async-overwrite the seed
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import { useEntityStore } from '../../stores/entityStore'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import { PilotDetailInner } from '../pilots/$id'
import { MechDetailInner } from '../mechs/$id'

// ---------------------------------------------------------------------------
// Fixtures — empty loadouts keep the render off the SRD-display path.
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString()

function makePilot(overrides: Partial<Pilot> = {}): Pilot {
  return {
    id: 'pilot-1',
    schemaVersion: 1,
    name: 'Zara Heln',
    callsign: 'Flash',
    classRef: 'scavenger',
    abilities: [],
    equipment: [],
    motto: '',
    keepsake: '',
    appearance: '',
    background: '',
    conditions: [],
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

function makeMech(overrides: Partial<Mech> = {}): Mech {
  return {
    id: 'mech-1',
    schemaVersion: 1,
    name: 'Iron Jaw',
    chassisRef: 'titan',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

function makeCrawler(overrides: Partial<Crawler> = {}): Crawler {
  return {
    id: 'crawler-1',
    schemaVersion: 1,
    name: 'Heavy Shell',
    techLevel: 'tech-2',
    systems: [],
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  }
}

function makeLink(link: Omit<SoftLink, 'createdAt'>): SoftLink {
  return { ...link, createdAt: now() }
}

function seed(opts: {
  pilots?: Pilot[]
  mechs?: Mech[]
  crawlers?: Crawler[]
  softLinks?: SoftLink[]
}): void {
  useEntityStore.setState((s) => ({
    ...s,
    pilots: opts.pilots ?? [],
    mechs: opts.mechs ?? [],
    crawlers: opts.crawlers ?? [],
    softLinks: opts.softLinks ?? [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  }))
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

// ---------------------------------------------------------------------------
// Minimal router — provides <Link> href resolution for the detail routes.
// ---------------------------------------------------------------------------

async function renderUnderRouter(node: ReactNode): Promise<void> {
  const rootRoute = createRootRoute({ component: () => <>{node}</> })
  const children = ['/pilots/$id', '/mechs/$id', '/crawlers/$id'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await act(async () => {
    render(<RouterProvider router={router} />)
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // PilotSheet's sub-controls resolve reference data inline.
  await SalvageUnionReference.preload('all')
})

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  cleanup()
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Pilot detail — crawler (outgoing) + mechs (incoming)
// ---------------------------------------------------------------------------

describe('Pilot detail — cross-links', () => {
  test('renders a clickable link to the assigned crawler', async () => {
    const pilot = makePilot()
    const crawler = makeCrawler()
    seed({
      pilots: [pilot],
      crawlers: [crawler],
      softLinks: [
        makeLink({
          id: 'link-p2c',
          from: { type: 'pilot', id: pilot.id },
          to: { type: 'crawler', id: crawler.id },
          type: 'pilot-to-crawler',
        }),
      ],
    })

    await renderUnderRouter(<PilotDetailInner id={pilot.id} />)

    const link = screen.getByRole('link', { name: 'Heavy Shell' })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe(`/crawlers/${crawler.id}`)
  })

  test('renders a clickable link to each assigned mech', async () => {
    const pilot = makePilot()
    const mech = makeMech()
    seed({
      pilots: [pilot],
      mechs: [mech],
      softLinks: [
        makeLink({
          id: 'link-m2p',
          from: { type: 'mech', id: mech.id },
          to: { type: 'pilot', id: pilot.id },
          type: 'mech-to-pilot',
        }),
      ],
    })

    await renderUnderRouter(<PilotDetailInner id={pilot.id} />)

    const link = screen.getByRole('link', { name: 'Iron Jaw' })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe(`/mechs/${mech.id}`)
  })

  test('shows the empty state (no link) when no mech is assigned', async () => {
    const pilot = makePilot()
    seed({ pilots: [pilot] })

    await renderUnderRouter(<PilotDetailInner id={pilot.id} />)

    expect(screen.getByText(/No mechs assigned/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Iron Jaw' })).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// Mech detail — pilot (outgoing)
// ---------------------------------------------------------------------------

describe('Mech detail — cross-links', () => {
  test('renders a clickable link to the linked pilot', async () => {
    const pilot = makePilot()
    const mech = makeMech()
    seed({
      pilots: [pilot],
      mechs: [mech],
      softLinks: [
        makeLink({
          id: 'link-m2p',
          from: { type: 'mech', id: mech.id },
          to: { type: 'pilot', id: pilot.id },
          type: 'mech-to-pilot',
        }),
      ],
    })

    await renderUnderRouter(<MechDetailInner id={mech.id} />)

    const link = screen.getByRole('link', { name: 'Zara Heln' })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe(`/pilots/${pilot.id}`)
  })
})
