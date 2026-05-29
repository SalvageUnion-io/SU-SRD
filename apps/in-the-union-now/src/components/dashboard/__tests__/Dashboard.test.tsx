/**
 * Dashboard component tests.
 *
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 * We exercise the real entityStore to keep tests honest.
 *
 * Note: uses .toBeTruthy() / .toBeFalsy() instead of .toBeInTheDocument() to
 * stay compatible with the project tsconfig (no jest-dom type augmentation).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
  rollResults: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
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

/** Render Dashboard and wait for hydration to complete. */
async function renderDashboard() {
  await act(async () => {
    render(<Dashboard />)
  })
  // Wait for the post-hydration sections to appear
  await screen.findByRole('heading', { name: 'Pilots' })
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
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard — section headings', () => {
  test('renders three sections: Pilots, Mechs, Crawlers', async () => {
    await renderDashboard()

    expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mechs' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Crawlers' })).toBeTruthy()
  })
})

describe('Dashboard — empty states', () => {
  test('shows Create Pilot CTA when no pilots exist', async () => {
    await renderDashboard()
    const createPilotLinks = screen.getAllByRole('link', { name: /Create Pilot/i })
    expect(createPilotLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Mech CTA when no mechs exist', async () => {
    await renderDashboard()
    const createMechLinks = screen.getAllByRole('link', { name: /Create Mech/i })
    expect(createMechLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Crawler CTA when no crawlers exist', async () => {
    await renderDashboard()
    const createCrawlerLinks = screen.getAllByRole('link', { name: /Create Crawler/i })
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

    // Confirm deletion
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })

    // Entity should no longer be in the connected document
    await waitFor(() => {
      const nodes = screen.queryAllByText('Tov Heln')
      const connected = nodes.filter((n) => n.isConnected)
      expect(connected.length).toBe(0)
    })
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
