/**
 * Dashboard component tests.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * We exercise the real entityStore to keep tests honest.
 *
 * Note: uses .toBeTruthy() / .toBeFalsy() instead of .toBeInTheDocument() to
 * stay compatible with the project tsconfig (no jest-dom type augmentation).
 *
 * act() hygiene: hydration (and delete) resolve through fake-indexeddb after
 * the initial act() block, so async store work is driven to completion with
 * settle() — repeated small act() blocks with the condition polled between
 * them — and the afterEach Zustand reset is act-wrapped (the component is
 * still mounted when it runs). State updates land inside act; no warnings.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { useEntityStore } from '../../../stores/entityStore'
import { Dashboard } from '../Dashboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
}

const baseMechInput = {
  schemaVersion: 1 as const,
  name: 'Iron Jaw',
  chassisRef: 'titan',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
}

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: {
      pilots: false,
      mechs: false,
      crawlers: false,
      softLinks: false,
    },
  })
}

/**
 * Drive pending async store work (fake-indexeddb) to completion inside act()
 * blocks, polling `done` between blocks — every React update lands inside
 * act, so no "not wrapped in act" warnings. Bounded at ~1s.
 */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

/** Render Dashboard and wait for hydration to complete (inside act). */
async function renderDashboard() {
  await act(async () => {
    render(<Dashboard />)
  })
  await settle(() => screen.queryByRole('heading', { name: 'Pilots' }) !== null)
  expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
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
  // The Dashboard may still be mounted here (RTL cleanup runs after this
  // hook), so the Zustand reset must happen inside act().
  act(() => {
    resetEntityStore()
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard — section headings', () => {
  test('renders three sections: Pilots, Mechs, Crawlers', async () => {
    await renderDashboard()

    expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mechs' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Crawlers' })).toBeTruthy()
  })

  test('renders the mobile segmented entity switch with Pilots active', async () => {
    await renderDashboard()

    const pilotsBtn = screen.getByRole('button', { name: 'Pilots' })
    const mechsBtn = screen.getByRole('button', { name: 'Mechs' })
    const crawlersBtn = screen.getByRole('button', { name: 'Crawlers' })
    expect(pilotsBtn.getAttribute('aria-pressed')).toBe('true')
    expect(mechsBtn.getAttribute('aria-pressed')).toBe('false')
    expect(crawlersBtn.getAttribute('aria-pressed')).toBe('false')

    await act(async () => {
      fireEvent.click(mechsBtn)
    })
    expect(mechsBtn.getAttribute('aria-pressed')).toBe('true')
    expect(pilotsBtn.getAttribute('aria-pressed')).toBe('false')
  })

  test('links the mech patterns route from the Mechs column head', async () => {
    await renderDashboard()

    const patternsLink = screen.getByRole('link', { name: 'Patterns' })
    expect((patternsLink as HTMLAnchorElement).href).toContain('/mechs/patterns')
  })

  test('renders the Download all / Import header row', async () => {
    await renderDashboard()

    expect(screen.getByRole('button', { name: 'Download all' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import…' })).toBeTruthy()
  })
})

describe('Dashboard — empty states', () => {
  test('shows Create Pilot CTA when no pilots exist', async () => {
    await renderDashboard()
    const createPilotLinks = screen.getAllByRole('link', {
      name: /Create Pilot/i,
    })
    expect(createPilotLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Mech CTA when no mechs exist', async () => {
    await renderDashboard()
    const createMechLinks = screen.getAllByRole('link', {
      name: /Create Mech/i,
    })
    expect(createMechLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Crawler CTA when no crawlers exist', async () => {
    await renderDashboard()
    const createCrawlerLinks = screen.getAllByRole('link', {
      name: /Create Crawler/i,
    })
    expect(createCrawlerLinks.length).toBeGreaterThan(0)
  })
})

describe('Dashboard — entity listing', () => {
  test('shows pilot name after hydration when pilot exists in db', async () => {
    // Pre-seed the db before rendering
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Kael Dusk' })

    // Reset to un-hydrated to simulate a fresh render
    resetEntityStore()

    await renderDashboard()

    expect(screen.getByText('Kael Dusk')).toBeTruthy()
  })

  test('row has a Sheet link that opens the live sheet', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, name: 'Nia Vale' })
    resetEntityStore()

    await renderDashboard()

    const sheetLinks = screen.getAllByRole('link', { name: 'Sheet' })
    expect(sheetLinks.length).toBe(1)
    expect((sheetLinks[0] as HTMLAnchorElement).href).toContain(`/sheet/pilot/${pilot.id}`)
  })

  test('row meta encodes cross-links by name via ↳', async () => {
    const store = useEntityStore.getState()
    await Promise.all([store.hydrate('pilot'), store.hydrate('mech'), store.hydrate('softLink')])
    const pilot = await store.create('pilot', {
      ...basePilotInput,
      name: 'Mara Vex',
    })
    const mech = await store.create('mech', {
      ...baseMechInput,
      name: 'Iron Fist',
    })
    await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })
    resetEntityStore()

    await renderDashboard()

    // Pilot row meta names the assigned mech; mech row meta names the pilot.
    expect(screen.getByText(/↳ Iron Fist/)).toBeTruthy()
    expect(screen.getByText(/↳ Mara Vex/)).toBeTruthy()
  })
})

describe('Dashboard — delete flow', () => {
  test('clicking delete opens confirm dialog with entity name', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Mira Cole' })
    resetEntityStore()

    await renderDashboard()

    // Click the Delete button for the pilot
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete Mira Cole/i }))
    })

    // Dialog should open with the entity name
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Delete Mira Cole/i)).toBeTruthy()
  })

  test('confirming delete removes entity from listing', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Tov Heln' })
    resetEntityStore()

    await renderDashboard()

    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete Tov Heln/i }))
    })

    // Confirm deletion (drive the async store delete to completion inside act)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    await settle(() => screen.queryAllByText('Tov Heln').filter((n) => n.isConnected).length === 0)

    // Entity should no longer be in the connected document
    const connected = screen.queryAllByText('Tov Heln').filter((n) => n.isConnected)
    expect(connected.length).toBe(0)
  })

  test('cancelling delete leaves entity in listing', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Fen Oya' })
    resetEntityStore()

    await renderDashboard()

    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete Fen Oya/i }))
    })

    // Cancel
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    // Entity should still be present
    expect(screen.getByText('Fen Oya')).toBeTruthy()
    // Dialog should be closed
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })
})
