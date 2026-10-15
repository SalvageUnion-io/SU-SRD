/**
 * Roster component tests: the front door signed out, Shelves signed in
 * (board S1).
 *
 * We exercise the real (in-memory) entityStore to keep tests honest.
 *
 * Note: uses .toBeTruthy() / .toBeFalsy() instead of .toBeInTheDocument() to
 * stay compatible with the project tsconfig (no jest-dom type augmentation).
 *
 * act() hygiene: a lazy hydration (and a delete's stubbed server commit)
 * resolves after the initial act() block, so async store work is driven to completion with
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
const { resetStores } = await import('../../../stores/__tests__/resetStores')
const { useEntityStore } = await import('../../../stores/entityStore')
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

/**
 * Drive pending async store work to completion inside act()
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

/** Seed one entity the way a signed-in player builds it: a store create. */
async function seedEntity(type: 'pilot' | 'mech', name: string): Promise<string> {
  const store = useEntityStore.getState()
  await store.hydrate(type)
  const created = await store.create(
    type,
    type === 'pilot' ? { ...basePilotInput, name } : { ...baseMechInput, name }
  )
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
  // Shelves, with no Games and no shared patterns.
  setQueryAnswers({
    'games:listMine': [],
    'shelf:patternSharing': [],
    'shelf:sharedByLink': [],
  })
  // The NPC shelf also lists encounter NPCs; an earlier file in the same
  // process can leave some in memory, so every store starts empty.
  resetStores()
})

afterEach(async () => {
  // Unmount before the reset: this hook runs before the preload's cleanup, and a
  // mounted Roster answers the reset by starting hydrations that resolve after act().
  cleanup()
  resetStores()
})

// ---------------------------------------------------------------------------
// Signed out: the front door
// ---------------------------------------------------------------------------

describe('Roster — signed out, it is the front door (board 09)', () => {
  // Outside any provider the connection is Solo: a signed-out visitor. Every
  // build lives in an account (ADR-034 as amended), so there is nothing of
  // theirs to list, create or import — but the Starter Set is reference, and
  // reading it needs no account.
  test('the chapter band, and no intro, create, import or game UI', async () => {
    await act(async () => {
      render(<Roster />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'The Cantina' })).toBeTruthy()
    // The intro band is gone (owner, 2026-10-14): signing in is the header's.
    expect(screen.queryByRole('region', { name: 'Welcome' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign in to build' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Create Pilot|New pilot/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
  })

  test('carries no invite-link note', async () => {
    await act(async () => {
      render(<Roster />)
    })
    expect(screen.queryByText(/invite link from your Mediator/)).toBeNull()
  })

  test('Start here is the SRD’s three steps, and playing is not one of them', async () => {
    await act(async () => {
      render(<Roster />)
    })
    const how = screen.getByRole('region', { name: 'Start here' })
    // Each step's slab carries its numeral aria-hidden: the heading's name is
    // the title alone.
    const spoken = (h: HTMLElement) => {
      const copy = h.cloneNode(true) as HTMLElement
      for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
      return copy.textContent?.trim()
    }
    expect(within(how).getAllByRole('heading', { level: 3 }).map(spoken)).toEqual([
      'Create a Pilot',
      'Create a Mech',
      'Join or make a Crawler',
    ])
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
  })
})

// ---------------------------------------------------------------------------
// Signed in: Shelves
// ---------------------------------------------------------------------------

describe('Shelves — the band', () => {
  test('the notched title, the Showing toggle on Everything, Import and Export all', async () => {
    await renderShelves()

    expect(screen.getByRole('heading', { level: 1, name: 'Shelves' })).toBeTruthy()
    expect(screen.queryByText(/Units in a Game stay on your shelf too\./)).toBeNull()
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

  test('patterns are user-made, and the NPC shelf offers the designer', async () => {
    await renderShelves()
    expect(screen.getByText('Your patterns, ready to build a Mech from.')).toBeTruthy()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/No NPCs yet/)).toBeTruthy()
    expect(within(npcs).queryByText(/on its way/)).toBeNull()
    expect(within(npcs).getByRole('link', { name: '+ Design an NPC' }).getAttribute('href')).toBe(
      '/npcs/new'
    )
  })

  test('a designed NPC is a dashed line with who can see it, on a shelf marked yours', async () => {
    const store = useEntityStore.getState()
    await store.hydrate('npc')
    const npc = await store.create('npc', {
      schemaVersion: 1,
      name: 'Doc Marrow',
      position: 'Doc',
      hitPoints: 6,
      damageType: 'HP',
      actions: [],
      traits: [],
    })
    await renderShelves()

    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText('Yours')).toBeTruthy()
    // Its chips lead the Row's chip group, so the link is the Row's cover and
    // the Row (`.su-entity-row`) holds what it reads.
    const line = within(npcs)
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === `/sheet/npc/${npc.id}`)
      ?.closest('.su-entity-row')
    expect(line?.querySelector('[data-user-made]')).not.toBeNull()
    // The dashes are the only visual cue, so the name says it too.
    expect(line?.textContent).toMatch(/user-made/i)
    expect(within(npcs).getByText('Only me')).toBeTruthy()
    expect(within(npcs).getByRole('button', { name: 'More for Doc Marrow' })).toBeTruthy()
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
    const link = within(pilots)
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === `/sheet/pilot/${id}`)
    expect(link?.getAttribute('aria-label')).toContain('Nia Vale')
    // The chip saying where it is sits in the Row's chip group, not under it.
    const line = link?.closest('.su-entity-row')
    expect(line?.textContent).toContain('Nia Vale')
    // What it is built as, never its kind (EDL E9: screen readers hear that).
    expect(line?.textContent).toContain('Engineer')
    expect(line?.textContent).not.toContain('Pilot ·')
    expect(line?.textContent).toContain('HP')
    expect(line?.textContent).toContain('Not in a Game')
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

    await renderShelves()

    expect(screen.getByText('Assigned: Iron Fist')).toBeTruthy()
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
