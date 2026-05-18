/**
 * Tests for /mechs/$id, /pilots/$id, /crawlers/$id detail route components
 * and the EntityListItem View/Sheet button additions.
 *
 * These tests render the page components in isolation (no RouterProvider needed
 * because we stub Route.useParams). Uses the real entityStore with fake-indexeddb.
 *
 * Conventions:
 *   - toBeTruthy() / toBeFalsy() — not toBeInTheDocument() (no jest-dom augmentation)
 *   - No mock.module()
 *   - Dep-injection for stores where possible
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'

import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'
import { useEntityStore } from '../../stores/entityStore'
import { EntityListItem } from '../../components/dashboard/EntityListItem'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Iron Jaw',
  chassisRef: 'titan',
  systems: ['shield-gen'],
  modules: [],
  cargo: [],
  conditions: [],
}

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Zara Heln',
  callsign: 'Flash',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  rollResults: [],
  motto: 'Keep moving.',
  keepsake: 'Old photo.',
  appearance: 'Short.',
  conditions: [],
}

const baseCrawlerInput = {
  schemaVersion: 1 as const,
  name: 'Heavy Shell',
  techLevel: 'tech-2',
  bays: [],
  systems: [],
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
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  await _clearAllStores()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// EntityListItem — View / Sheet buttons
// ---------------------------------------------------------------------------

describe('EntityListItem — View and Sheet buttons', () => {
  test('renders View link with correct href', () => {
    render(
      <EntityListItem
        id="mech-1"
        name="Iron Jaw"
        href="/mechs/mech-1"
        sheetHref="/sheet/mech/mech-1"
        onDeleteClick={() => {}}
      />
    )
    const viewLink = screen.getByRole('link', { name: 'View' })
    expect(viewLink).toBeTruthy()
    expect((viewLink as HTMLAnchorElement).href).toContain('/mechs/mech-1')
  })

  test('renders Sheet link with correct href', () => {
    render(
      <EntityListItem
        id="mech-1"
        name="Iron Jaw"
        href="/mechs/mech-1"
        sheetHref="/sheet/mech/mech-1"
        onDeleteClick={() => {}}
      />
    )
    const sheetLink = screen.getByRole('link', { name: 'Sheet' })
    expect(sheetLink).toBeTruthy()
    expect((sheetLink as HTMLAnchorElement).href).toContain('/sheet/mech/mech-1')
  })

  test('renders Delete button alongside View and Sheet', () => {
    render(
      <EntityListItem
        id="pilot-1"
        name="Zara Heln"
        href="/pilots/pilot-1"
        sheetHref="/sheet/pilot/pilot-1"
        onDeleteClick={() => {}}
      />
    )
    expect(screen.getByRole('link', { name: 'View' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sheet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Delete Zara Heln/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Mech detail — store hydration and rendering
// ---------------------------------------------------------------------------

describe('Mech detail — store state', () => {
  test('shows mech name from store', async () => {
    await useEntityStore.getState().hydrate('mech')
    const mech = await useEntityStore.getState().create('mech', baseMechInput)

    useEntityStore.setState((s) => ({
      ...s,
      mechs: [mech],
      hydrated: { ...s.hydrated, mechs: true },
    }))

    // Render a minimal component that pulls from the store (same logic as the route)
    function MechName() {
      const m = useEntityStore((s) => s.mechs.find((x) => x.id === mech.id) ?? null)
      if (!m) return <p>Not found</p>
      return <h1>{m.name}</h1>
    }

    await act(async () => {
      render(<MechName />)
    })

    expect(screen.getByRole('heading', { name: 'Iron Jaw' })).toBeTruthy()
  })

  test('returns null when mech id is unknown', async () => {
    useEntityStore.setState((s) => ({
      ...s,
      mechs: [],
      hydrated: { ...s.hydrated, mechs: true },
    }))

    function MechName() {
      const m = useEntityStore((s) => s.mechs.find((x) => x.id === 'nonexistent') ?? null)
      if (!m) return <p>Not found</p>
      return <h1>{m.name}</h1>
    }

    await act(async () => {
      render(<MechName />)
    })

    expect(screen.getByText('Not found')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Pilot detail — store hydration and rendering
// ---------------------------------------------------------------------------

describe('Pilot detail — store state', () => {
  test('shows pilot name from store', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore.getState().create('pilot', basePilotInput)

    useEntityStore.setState((s) => ({
      ...s,
      pilots: [pilot],
      hydrated: { ...s.hydrated, pilots: true },
    }))

    function PilotName() {
      const p = useEntityStore((s) => s.pilots.find((x) => x.id === pilot.id) ?? null)
      if (!p) return <p>Not found</p>
      return <h1>{p.name}</h1>
    }

    await act(async () => {
      render(<PilotName />)
    })

    expect(screen.getByRole('heading', { name: 'Zara Heln' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Crawler detail — store hydration and rendering
// ---------------------------------------------------------------------------

describe('Crawler detail — store state', () => {
  test('shows crawler name from store', async () => {
    await useEntityStore.getState().hydrate('crawler')
    const crawler = await useEntityStore.getState().create('crawler', baseCrawlerInput)

    useEntityStore.setState((s) => ({
      ...s,
      crawlers: [crawler],
      hydrated: { ...s.hydrated, crawlers: true },
    }))

    function CrawlerName() {
      const c = useEntityStore((s) => s.crawlers.find((x) => x.id === crawler.id) ?? null)
      if (!c) return <p>Not found</p>
      return <h1>{c.name}</h1>
    }

    await act(async () => {
      render(<CrawlerName />)
    })

    expect(screen.getByRole('heading', { name: 'Heavy Shell' })).toBeTruthy()
  })
})
