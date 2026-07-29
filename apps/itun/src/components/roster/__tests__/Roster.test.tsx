/**
 * Roster component tests.
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
import { Roster } from '../Roster'

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

/**
 * Render Roster and wait for hydration to complete (inside act). After
 * hydration the tree is either the normal grid (Pilots heading) or the
 * first-run welcome panel (Welcome heading) — poll on whichever appears so the
 * helper works for both an empty store and a seeded one.
 */
async function renderRoster() {
  await act(async () => {
    render(<Roster />)
  })
  await settle(
    () =>
      screen.queryByRole('heading', { name: 'Pilots' }) !== null ||
      screen.queryByRole('heading', { name: /Welcome/i }) !== null
  )
}

/**
 * Seed one entity so the normal 3-column grid renders (any non-empty total
 * exits the first-run aggregate empty state). Returns after resetting the
 * in-memory store so the subsequent render re-hydrates from IndexedDB.
 */
async function seedEntity(type: 'pilot' | 'mech', name: string): Promise<void> {
  const store = useEntityStore.getState()
  await store.hydrate(type)
  await store.create(
    type,
    type === 'pilot' ? { ...basePilotInput, name } : { ...baseMechInput, name }
  )
  resetEntityStore()
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
  // The Roster may still be mounted here (RTL cleanup runs after this
  // hook), so the Zustand reset must happen inside act().
  act(() => {
    resetEntityStore()
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Roster — section headings', () => {
  test('renders three sections: Pilots, Mechs, Crawlers', async () => {
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()

    expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mechs' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Crawlers' })).toBeTruthy()
  })

  test('renders the mobile segmented entity switch with Pilots active', async () => {
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()

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
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()

    const patternsLink = screen.getByRole('link', { name: 'Patterns' })
    expect((patternsLink as HTMLAnchorElement).href).toContain('/mechs/patterns')
  })

  test('renders the Download all / Import header row', async () => {
    await renderRoster()

    expect(screen.getByRole('button', { name: 'Download all' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import…' })).toBeTruthy()
  })
})

describe('Roster — empty states', () => {
  // Per-column empty states are only reachable once at least one entity exists
  // (a wholly empty store shows the first-run welcome panel instead), so each
  // test seeds a NON-target entity to render the grid with the target column
  // empty.
  test('shows Create Pilot CTA when no pilots exist', async () => {
    await seedEntity('mech', 'Seed Mech')
    await renderRoster()
    const createPilotLinks = screen.getAllByRole('link', {
      name: /Create Pilot/i,
    })
    expect(createPilotLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Mech CTA when no mechs exist', async () => {
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()
    const createMechLinks = screen.getAllByRole('link', {
      name: /Create Mech/i,
    })
    expect(createMechLinks.length).toBeGreaterThan(0)
  })

  test('shows Create Crawler CTA when no crawlers exist', async () => {
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()
    const createCrawlerLinks = screen.getAllByRole('link', {
      name: /Create Crawler/i,
    })
    expect(createCrawlerLinks.length).toBeGreaterThan(0)
  })
})

describe('Roster — first-run welcome', () => {
  test('shows the welcome panel and build CTA when the store is wholly empty', async () => {
    await renderRoster()

    expect(screen.getByRole('heading', { name: /Welcome to In the Union Now/i })).toBeTruthy()
    const buildLink = screen.getByRole('link', { name: /Build your first pilot/i })
    expect((buildLink as HTMLAnchorElement).href).toContain('/pilots/new')
    // Normal grid headings are absent in the first-run state.
    expect(screen.queryByRole('heading', { name: 'Pilots' })).toBeFalsy()
  })

  test('reverts to the normal grid once any entity exists', async () => {
    await seedEntity('pilot', 'Seed Pilot')
    await renderRoster()

    expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Welcome to In the Union Now/i })).toBeFalsy()
  })
})

describe('Roster — Starter Set (spawned on demand)', () => {
  // The Starter Set is NOT pre-seeded. With Workspaces retired it is no longer
  // an entry in a switcher; it has its own button, which spawns it onto the
  // Shelf via ensureStarterSetSeeded and then disappears.

  test('a fresh user sees the welcome screen and a Load Starter Set button, nothing seeded yet', async () => {
    await renderRoster()

    expect(screen.getByRole('heading', { name: /Welcome to In the Union Now/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load Starter Set' })).toBeTruthy()
    // Nothing spawned yet — no crew rendered.
    expect(screen.queryByText('Bonesaw')).toBeFalsy()
  })

  test('loading the Starter Set spawns it into the browser and renders the crew', async () => {
    await renderRoster()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load Starter Set' }))
    })
    // Seeding is async (IndexedDB write + rehydrate) — settle until the crew shows.
    //
    // getAll, not get: a crew member's name now appears BOTH in its own row's
    // name tab and in the tone-tinted cross-link badge on every row wired to
    // it. The badge used to read '↳ Bonesaw', which no exact-text query
    // matched; it now reads 'Bonesaw' exactly, so a singular query throws on
    // multiple matches instead of returning the row.
    await settle(() => screen.queryAllByText('Bonesaw').length > 0)

    expect(screen.getByRole('heading', { name: 'Pilots' })).toBeTruthy()
    expect(screen.getAllByText('Bonesaw').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Scrapper').length).toBeGreaterThan(0)
    expect(screen.getAllByText("Crawler #430 'Tenacity'").length).toBeGreaterThan(0)
  })
})

describe('Roster — entity listing', () => {
  test('shows pilot name after hydration when pilot exists in db', async () => {
    // Pre-seed the db before rendering
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Kael Dusk' })

    // Reset to un-hydrated to simulate a fresh render
    resetEntityStore()

    await renderRoster()

    expect(screen.getByText('Kael Dusk')).toBeTruthy()
  })

  test('row has a Sheet link that opens the live sheet', async () => {
    await useEntityStore.getState().hydrate('pilot')
    const pilot = await useEntityStore
      .getState()
      .create('pilot', { ...basePilotInput, name: 'Nia Vale' })
    resetEntityStore()

    await renderRoster()

    const sheetLinks = screen.getAllByRole('link', { name: 'View' })
    expect(sheetLinks.length).toBe(1)
    expect((sheetLinks[0] as HTMLAnchorElement).href).toContain(`/sheet/pilot/${pilot.id}`)
  })

  test('row meta encodes cross-links as tone-tinted badges linking to the target sheet', async () => {
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

    await renderRoster()

    // Pilot row meta names the assigned mech; mech row meta names the pilot.
    // These used to be muted '↳ Name' text; they are now Badges tinted with the
    // TARGET's ontology tone, so the assertion is on the link + its tone class
    // rather than on the arrow glyph.
    // Targeted by accessible name, not by href: every row also has its own
    // "View" link to the same sheet, so href alone matches two elements.
    // The label names the TARGET, so the pilot row's badge reads "Iron Fist".
    const toMech = screen.getByRole('link', { name: /open iron fist's mech sheet/i })
    const toPilot = screen.getByRole('link', { name: /open mara vex's pilot sheet/i })
    expect(toMech.getAttribute('href')).toBe(`/sheet/mech/${mech.id}`)
    expect(toPilot.getAttribute('href')).toBe(`/sheet/pilot/${pilot.id}`)
    expect(toMech.textContent).toContain('Iron Fist')
    expect(toPilot.textContent).toContain('Mara Vex')

    // The tone is the destination's, not the row's — a pilot row's mech badge
    // is mech-toned. This is the whole point of the change.
    expect(toMech.querySelector('.bg-mech')).toBeTruthy()
    expect(toPilot.querySelector('.bg-pilot')).toBeTruthy()
  })
})

describe('Roster — delete flow', () => {
  test('clicking delete opens confirm dialog with entity name', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Mira Cole' })
    resetEntityStore()

    await renderRoster()

    // Click the Delete button for the pilot
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete Mira Cole/i }))
    })

    // Dialog should open with the entity name (title renders visibly in the
    // ModalShell header plus sr-only Dialog.Title/Description)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getAllByText(/Delete Mira Cole/i).length).toBeGreaterThan(0)
  })

  test('confirming delete removes entity from listing', async () => {
    await useEntityStore.getState().hydrate('pilot')
    await useEntityStore.getState().create('pilot', { ...basePilotInput, name: 'Tov Heln' })
    resetEntityStore()

    await renderRoster()

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

    await renderRoster()

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
