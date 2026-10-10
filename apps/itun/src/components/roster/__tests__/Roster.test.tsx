/**
 * Roster component tests: the front door signed out, Shelves signed in
 * (issue 1279, board S1).
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
 * them — and afterEach unmounts before it resets the Zustand store. State
 * updates land inside act; no warnings.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

// Signed in: building needs an account (ADR-034 as amended), so the roster a
// player builds into is a Connected one. Module scope, before the imports
// below — `mock.module` only affects imports that resolve after it runs.
const convexMocks = await installConvexMocks({
  // `upsertByAppId` answers with the row's new version.
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  // The signed-out panel's "Sign in with Discord".
  authReact: true,
})

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { clearCache, _resetDbSingleton } = await import('../../../lib/db/index')
const { useEntityStore } = await import('../../../stores/entityStore')
const { usePatternStore } = await import('../../../stores/patternStore')
const { Roster } = await import('../Roster')

withSignedInBackend()

afterAll(() => convexMocks.restore())

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'engineer',
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
      npcs: false,
      softLinks: false,
    },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: false })
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

/** Render Shelves and wait for the shelves to replace the skeleton. */
async function renderShelves() {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <Roster />
      </ConnectionContext.Provider>
    )
  })
  await settle(() => screen.queryByRole('heading', { name: 'Pilots' }) !== null)
}

/** Seed one entity into the cache, then forget it in memory so the render re-hydrates. */
async function seedEntity(type: 'pilot' | 'mech', name: string): Promise<string> {
  const store = useEntityStore.getState()
  await store.hydrate(type)
  const created = await store.create(
    type,
    type === 'pilot' ? { ...basePilotInput, name } : { ...baseMechInput, name }
  )
  resetEntityStore()
  return created.id
}

/** Open an item's ⋯ menu and return it. */
async function openMenu(name: string): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }))
  })
  return screen.getByRole('menu')
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Shelves, with no Games, no invitations and no shared patterns.
  setQueryAnswers({ 'games:listMine': [], 'invites:forMe': [], 'shelf:patternSharing': [] })
  _resetDbSingleton()
  await clearCache()
  resetEntityStore()
})

afterEach(async () => {
  // Unmount before the reset: this hook runs before the preload's cleanup, and a
  // mounted Roster answers the reset by starting hydrations that resolve after act().
  cleanup()
  await clearCache()
  resetEntityStore()
})

// ---------------------------------------------------------------------------
// Signed out: the front door
// ---------------------------------------------------------------------------

describe('Roster — signed out, it is the front door (board 09)', () => {
  // Outside any provider the connection is Solo: a signed-out visitor. Every
  // build lives in an account (ADR-034 as amended), so there is nothing of
  // theirs to list, create or import — but the Starter Set is reference, and
  // reading it needs no account.
  test('the chapter band, the sign-in, and no create, import or game UI', async () => {
    await act(async () => {
      render(<Roster />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'In The Union Now' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in to build' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Create Pilot|New pilot/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ New game' })).toBeNull()
  })

  test('says a Game is joined from an invite link, with no code to type', async () => {
    await act(async () => {
      render(<Roster />)
    })
    expect(screen.getByText(/Got an invite link from your Mediator\?/)).toBeTruthy()
    expect(screen.getByText(/no codes to type/)).toBeTruthy()
  })

  test('how it works is three steps, and playing is not one of them', async () => {
    await act(async () => {
      render(<Roster />)
    })
    const how = screen.getByRole('region', { name: 'How it works' })
    expect(
      within(how)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(['Create a Pilot', 'Create a Mech', 'Join or make a Crawler'])
  })

  test('the Starter Set is clickable rows, with one Leyline Press credit', async () => {
    await act(async () => {
      render(<Roster />)
    })

    const starter = screen.getByRole('region', { name: 'Starter Set' })
    expect(within(starter).getByRole('link', { name: 'Read Bonesaw' }).getAttribute('href')).toBe(
      '/starter/pilot/starter-pilot-bonesaw'
    )
    expect(within(starter).getAllByText(/Leyline Press/)).toHaveLength(1)
    expect(within(starter).getByText(/sign in to copy one/)).toBeTruthy()
    // A shelf per kind, each counting its rows.
    expect(within(starter).getByRole('region', { name: 'Starter Set pilots' })).toBeTruthy()
    expect(within(starter).getByRole('region', { name: 'Starter Set mechs' })).toBeTruthy()
    expect(within(starter).getByRole('region', { name: 'Starter Set crawler' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read a Starter Set sheet' })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Signed in: Shelves
// ---------------------------------------------------------------------------

describe('Shelves — the band', () => {
  test('the notched title, the Showing toggle on Everything, Import and Export all', async () => {
    await renderShelves()

    expect(screen.getByRole('heading', { level: 1, name: 'Shelves' })).toBeTruthy()
    expect(screen.getByText(/Units in a Game stay on your shelf too\./)).toBeTruthy()
    const showing = screen.getByRole('group', { name: 'Showing' })
    expect(
      within(showing)
        .getAllByRole('button')
        .map((b) => [b.textContent, b.getAttribute('aria-pressed')])
    ).toEqual([
      ['Everything', 'true'],
      ['Not in a Game', 'false'],
    ])
    expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export all' })).toBeTruthy()
    // "My Stuff" is gone: the page is Shelves.
    expect(screen.queryByText(/My Stuff/)).toBeNull()
  })
})

describe('Shelves — one shelf per kind', () => {
  test('Pilots, Mechs, Crawlers, Patterns and NPCs, then the Starter Set', async () => {
    await renderShelves()

    for (const name of ['Pilots', 'Mechs', 'Crawlers', 'Patterns', 'NPCs', 'Starter Set']) {
      expect(screen.getByRole('region', { name })).toBeTruthy()
    }
  })

  test('each unit shelf builds a new one onto the shelf', async () => {
    await renderShelves()

    const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf('+ New pilot')).toBe('/pilots/new')
    expect(hrefOf('+ New mech')).toBe('/mechs/new')
    expect(hrefOf('+ New crawler')).toBe('/crawlers/new')
    expect(screen.getByRole('button', { name: '+ From a mech' })).toBeTruthy()
  })

  test('an empty shelf says so', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('No pilots yet.')).toBeTruthy()
  })

  test('patterns are user-made, and the NPC shelf waits for the designer', async () => {
    await renderShelves()
    expect(screen.getByText('User-made: dashed, like everything players make.')).toBeTruthy()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/The NPC designer is on its way/)).toBeTruthy()
    expect(within(npcs).queryByRole('button')).toBeNull()
  })

  test('the Starter Set is read-only: each unit opens its sheet to read', async () => {
    await renderShelves()
    const starter = screen.getByRole('region', { name: 'Starter Set' })
    expect(within(starter).getByText('read-only')).toBeTruthy()
    expect(within(starter).getByRole('link', { name: 'Read Bonesaw' }).getAttribute('href')).toBe(
      '/starter/pilot/starter-pilot-bonesaw'
    )
    // Thirteen: six pilots, six mechs and the crawler.
    expect(within(starter).getAllByRole('link')).toHaveLength(13)
  })
})

describe('Shelves — items', () => {
  test('an item is one line that opens its sheet, with a chip saying where it is', async () => {
    const id = await seedEntity('pilot', 'Nia Vale')
    await renderShelves()

    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const line = within(pilots)
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === `/sheet/pilot/${id}`)
    expect(line?.textContent).toContain('Nia Vale')
    expect(line?.textContent).toContain('Pilot · Engineer')
    expect(line?.textContent).toContain('HP')
    expect(within(pilots).getByText('Not in a Game')).toBeTruthy()
  })

  test('linked units are named in each other’s chips', async () => {
    const store = useEntityStore.getState()
    await Promise.all([store.hydrate('pilot'), store.hydrate('mech'), store.hydrate('softLink')])
    const pilot = await store.create('pilot', { ...basePilotInput, name: 'Mara Vex' })
    const mech = await store.create('mech', { ...baseMechInput, name: 'Iron Fist' })
    await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })
    resetEntityStore()

    await renderShelves()

    expect(screen.getByText('Linked: Iron Fist')).toBeTruthy()
    expect(screen.getByText('Pilot: Mara Vex')).toBeTruthy()
  })

  test('the ⋯ menu offers Open, Move, Make a copy, Save as pattern (mechs), Export and Delete', async () => {
    await seedEntity('mech', 'Iron Jaw')
    await renderShelves()

    const menu = await openMenu('Iron Jaw')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Open', 'Move to a Game…', 'Make a copy', 'Save as pattern', 'Export', 'Delete…'])
  })

  test('a pilot’s menu has no Save as pattern', async () => {
    await seedEntity('pilot', 'Kael Dusk')
    await renderShelves()

    const menu = await openMenu('Kael Dusk')
    expect(within(menu).queryByRole('menuitem', { name: 'Save as pattern' })).toBeNull()
  })
})

describe('Shelves — Make a copy', () => {
  test('asks first, then puts a separate copy on the shelf', async () => {
    await seedEntity('pilot', 'Fen Oya')
    await renderShelves()

    const menu = await openMenu('Fen Oya')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Make a copy' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Make a copy of Fen Oya?')

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await settle(() => screen.queryByText('COPY OF Fen Oya') !== null)

    expect(screen.getByText('COPY OF Fen Oya')).toBeTruthy()
    expect(screen.getByText('Fen Oya')).toBeTruthy()
    const names = useEntityStore
      .getState()
      .list('pilot')
      .map((p) => p.name)
    expect(names.sort()).toEqual(['COPY OF Fen Oya', 'Fen Oya'])
  })
})

describe('Shelves — delete flow', () => {
  test('Delete… opens the confirm, naming the build', async () => {
    await seedEntity('pilot', 'Mira Cole')
    await renderShelves()

    const menu = await openMenu('Mira Cole')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getAllByText(/Delete Mira Cole/i).length).toBeGreaterThan(0)
  })

  test('confirming removes it from the shelf', async () => {
    await seedEntity('pilot', 'Tov Heln')
    await renderShelves()

    const menu = await openMenu('Tov Heln')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    await settle(() => screen.queryAllByText('Tov Heln').filter((n) => n.isConnected).length === 0)

    expect(screen.queryAllByText('Tov Heln').filter((n) => n.isConnected)).toHaveLength(0)
  })

  test('cancelling leaves it where it was', async () => {
    await seedEntity('pilot', 'Fen Oya')
    await renderShelves()

    const menu = await openMenu('Fen Oya')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(screen.getByText('Fen Oya')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeFalsy()
  })
})
