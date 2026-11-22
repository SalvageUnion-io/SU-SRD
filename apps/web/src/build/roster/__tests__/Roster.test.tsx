/**
 * Roster component tests: the front door signed out, Shelves signed in.
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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Signed in: building needs an account (ADR-034 as amended), so the roster a
// player builds into is a Connected one. Module scope, before the imports
// below — `mock.module` only affects imports that resolve after it runs.
const serverMocks = await installServerMocks()

const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { useUnits } = await import('../../../replica/units')
const { Roster } = await import('../Roster')
const { Shelves } = await import('../../shelves/Shelves')
const { ShelvesPart } = await import('../../shelves/shelvesPart.model')

withSignedInBackend()

afterAll(() => serverMocks.restore())

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
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
      <SyncContext.Provider value={CONNECTED}>
        <Roster />
      </SyncContext.Provider>
    )
  })
  await settle(() => screen.queryByRole('region', { name: 'Pilots' }) !== null)
}

/** The Mediator's Kit, the Games front's half of the shelves (NPCs, Encounters). */
async function renderKit() {
  await act(async () => {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <ShelvesPart.Provider value="kit">
          <Shelves />
        </ShelvesPart.Provider>
      </SyncContext.Provider>
    )
  })
  await settle(() => screen.queryByRole('region', { name: 'NPCs' }) !== null)
}

/** Seed one entity the way a signed-in player builds it: a store create. */
async function seedEntity(type: 'pilot' | 'mech', name: string): Promise<string> {
  const store = useUnits.getState()
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
    'games.listMine': [],
    'shelf.patternSharing': [],
    'shelf.sharedByLink': [],
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

describe('Roster — signed out, it is the front door', () => {
  // Outside any provider the connection is Solo: a signed-out visitor. Every
  // build lives in an account (ADR-034 as amended), so there is nothing of
  // theirs to list, create or import — but the Starter Set is reference, and
  // reading it needs no account.
  test('the chapter band, and no intro, create, import or game UI', async () => {
    await act(async () => {
      render(<Roster />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Training Bay' })).toBeTruthy()
    // The intro band is gone: signing in is the header's.
    expect(screen.queryByRole('region', { name: 'Welcome' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign in to build' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Create Pilot|New Pilot/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Backups: import and export' })).toBeNull()
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

  test('the Starter Set crew is one Ledger, a line a build that opens its sheet, credited once', async () => {
    await act(async () => {
      render(<Roster />)
    })

    const starter = screen.getByRole('region', { name: 'Starter Set' })
    const crew = within(starter).getByRole('table', { name: 'Pilots & their Mechs' })
    expect(within(crew).getByRole('link', { name: 'Bonesaw' }).getAttribute('href')).toBe(
      '/starter/pilot/starter-pilot-bonesaw'
    )
    // Each Pilot's line names their Mech, which opens its own sheet; the
    // Crawler is its own Ledger under them.
    const bonesaw = within(crew).getByRole('link', { name: 'Bonesaw' }).closest('tr')
    const mech = bonesaw?.querySelector<HTMLAnchorElement>('td a')
    expect(mech?.getAttribute('href')).toMatch(/^\/starter\/mech\//)
    expect(within(starter).getByRole('table', { name: 'Union Crawler' })).toBeTruthy()
    // Whose crew it is, said once over the list (the Ledger's foot cites the book).
    expect(within(starter).getAllByText(/Leyline Press/, { selector: 'p' })).toHaveLength(1)
    expect(within(starter).getByText(/sign in to copy one/)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Signed in: Shelves
// ---------------------------------------------------------------------------

describe('Training Bay — the band', () => {
  test('the notched title, the backups menu, and no Showing filter', async () => {
    await renderShelves()

    expect(screen.getByRole('heading', { level: 1, name: 'Training Bay' })).toBeTruthy()
    expect(screen.queryByText(/Units in a Game stay on your shelf too\./)).toBeNull()
    // A unit's Game is its chip, never a filter (chips-and-actions C13).
    expect(screen.queryByLabelText('Showing')).toBeNull()
    // Import… and Export all are the band's one "⋯".
    fireEvent.click(screen.getByRole('button', { name: 'Backups: import and export' }))
    const backups = await screen.findByRole('menu')
    expect(
      within(backups)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Import…', 'Export all'])
    fireEvent.keyDown(backups, { key: 'Escape' })
    // A Game is started on the Play hub, never in Build (ADR-052 §1).
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
    // "My Stuff" is gone: the page is Shelves.
    expect(screen.queryByText(/My Stuff/)).toBeNull()
  })
})

describe('Training Bay — one shelf per kind', () => {
  test('Pilots, Mechs, Crawlers and Patterns, then the Starter Set; NPCs are the Games front kit', async () => {
    await renderShelves()

    for (const name of ['Pilots', 'Mechs', 'Crawlers', 'Patterns', 'Starter Set']) {
      expect(screen.getByRole('region', { name })).toBeTruthy()
    }
    // The Mediator's Kit is on the Games front (ADR-066), never the Training Bay.
    expect(screen.queryByRole('region', { name: 'NPCs' })).toBeNull()
  })

  test('each unit shelf builds a new one onto the shelf', async () => {
    await renderShelves()

    const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf('+ New Pilot')).toBe('/pilots/new')
    expect(hrefOf('+ New Mech')).toBe('/mechs/new')
    expect(hrefOf('+ New crawler')).toBe('/crawlers/new')
    expect(screen.getByRole('button', { name: '+ From a Mech' })).toBeTruthy()
  })

  test('an empty shelf says so', async () => {
    await renderShelves()
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('No Pilots yet.')).toBeTruthy()
  })

  test('a signed-in bay with nothing in it keeps Start here; one unit and it is gone', async () => {
    await renderShelves()
    expect(screen.getByRole('region', { name: 'Start here' })).toBeTruthy()
    cleanup()
    await seedEntity('mech', 'Iron Jaw')
    await renderShelves()
    expect(screen.queryByRole('region', { name: 'Start here' })).toBeNull()
  })

  test('the NPC shelf offers the designer', async () => {
    await renderKit()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/No NPCs yet/)).toBeTruthy()
    expect(within(npcs).queryByText(/on its way/)).toBeNull()
    expect(within(npcs).getByRole('link', { name: '+ Design an NPC' }).getAttribute('href')).toBe(
      '/npcs/new'
    )
  })

  test('a designed NPC is a line that opens its sheet, with who can see it', async () => {
    const store = useUnits.getState()
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
    await renderKit()

    const npcs = screen.getByRole('region', { name: 'NPCs' })
    // Its name is the link to its sheet; its line reads its position, who can
    // see it and its HP, a column each; in no Game, the shelf has no Game column (L5).
    const line = within(npcs).getByRole('link', { name: 'Doc Marrow' }).closest('tr')
    expect(within(npcs).getByRole('link', { name: 'Doc Marrow' }).getAttribute('href')).toBe(
      `/npcs/${npc.id}`
    )
    expect(
      within(line as HTMLElement)
        .getAllByRole('cell')
        .map((td) => td.textContent)
        .slice(0, 3)
    ).toEqual(['Doc', 'Only me', '6/6'])
    expect(within(npcs).getByRole('button', { name: 'More for Doc Marrow' })).toBeTruthy()
  })

  test('the Starter Set is folded under your builds, and opens to the front door’s Ledger', async () => {
    await renderShelves()
    const starter = screen.getByRole('region', { name: 'Starter Set' })
    expect(within(starter).getByText('read-only')).toBeTruthy()
    const toggle = within(starter).getByRole('button', { name: 'Expand Starter Set' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(within(starter).queryByRole('link', { name: 'Bonesaw' })).toBeNull()

    fireEvent.click(toggle)

    expect(
      within(starter)
        .getByRole('button', { name: 'Collapse Starter Set' })
        .getAttribute('aria-expanded')
    ).toBe('true')
    const crew = within(starter).getByRole('table', { name: 'Pilots & their Mechs' })
    expect(within(crew).getByRole('link', { name: 'Bonesaw' }).getAttribute('href')).toBe(
      '/starter/pilot/starter-pilot-bonesaw'
    )
    expect(within(starter).getAllByText(/Leyline Press/, { selector: 'p' })).toHaveLength(1)
  })
})

describe('Training Bay — items', () => {
  test('an item is one line that opens its sheet; in no Game, its Game lane is empty', async () => {
    const id = await seedEntity('pilot', 'Nia Vale')
    await renderShelves()

    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const link = within(pilots).getByRole('link', { name: 'Ghost · Nia Vale' })
    expect(link.getAttribute('href')).toBe(`/pilots/${id}`)
    const line = link.closest('tr')
    // What it is built as, never its kind (EDL E9: screen readers hear that).
    expect(line?.textContent).toContain('Engineer')
    expect(line?.textContent).not.toContain('Pilot ·')
    // In no Game: its Game column is empty, never "Unassigned" (C11).
    expect(line?.querySelector('a[href^="/games/"]')).toBeNull()
    expect(line?.textContent).not.toContain('Unassigned')
  })

  test('a pilot’s line carries the mech it flies, a link to its sheet; the Mechs ledger holds the rest', async () => {
    const store = useUnits.getState()
    await Promise.all([store.hydrate('pilot'), store.hydrate('mech'), store.hydrate('softLink')])
    const pilot = await store.create('pilot', { ...basePilotInput, name: 'Mara Vex' })
    const mech = await store.create('mech', { ...baseMechInput, name: 'Iron Fist' })
    await store.create('softLink', {
      from: { type: 'mech', id: mech.id },
      to: { type: 'pilot', id: pilot.id },
      type: 'mech-to-pilot',
    })

    await renderShelves()

    // The pilot's line names its Mech (ADR-066 §4): its column, and under the
    // name for a phone, where the column is hidden.
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    const itsMech = within(
      within(pilots).getByRole('link', { name: 'Ghost · Mara Vex' }).closest('tr') as HTMLElement
    ).getAllByRole('link', { name: 'Iron Fist' })
    expect(itsMech.map((a) => a.getAttribute('href'))).toEqual([
      `/mechs/${mech.id}`,
      `/mechs/${mech.id}`,
    ])
    // A mech a pilot flies is on that pilot's line, not again on the Mechs ledger.
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).queryByRole('link', { name: 'Iron Fist' })).toBeNull()
    expect(within(mechs).getByText('None. A Mech with a Pilot is on its Pilot’s row.')).toBeTruthy()
    expect(screen.queryByText(/^Assigned: /)).toBeNull()
  })

  test('the ⋯ menu offers Open, Move, Make a copy, Rename and Save as pattern (mechs), Export and Delete', async () => {
    await seedEntity('mech', 'Iron Jaw')
    await renderShelves()

    const menu = await openMenu('Iron Jaw')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      'Open',
      'Move to a Game…',
      'Make a copy',
      'Rename…',
      'Save as pattern',
      'Export',
      'Delete…',
    ])
  })

  test('Rename… changes a mech’s name from the list', async () => {
    const mech = await seedEntity('mech', 'Iron Jaw')
    await renderShelves()
    fireEvent.click(within(await openMenu('Iron Jaw')).getByRole('menuitem', { name: 'Rename…' }))
    const field = await screen.findByRole('textbox', { name: 'Mech name' })
    fireEvent.change(field, { target: { value: 'Iron Jaw Mk II' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(useUnits.getState().get('mech', mech)?.name).toBe('Iron Jaw Mk II'))
  })

  test('the Mechs shelf says a build’s slots and Scrap, and a column sorts it', async () => {
    await seedEntity('mech', 'Bravo')
    await useUnits
      .getState()
      .create('mech', { ...baseMechInput, name: 'Alpha', chassisRef: 'mule' })
    await renderShelves()
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    const names = () =>
      within(mechs)
        .getAllByRole('link')
        .map((a) => a.textContent)
        .filter((text) => text === 'Alpha' || text === 'Bravo')
    expect(within(mechs).getByRole('button', { name: /sort by cost/i })).toBeTruthy()
    const byName = () => within(mechs).getByRole('button', { name: /sort by mechs/i })
    fireEvent.click(byName())
    expect(names()).toEqual(['Alpha', 'Bravo'])
    fireEvent.click(byName())
    expect(names()).toEqual(['Bravo', 'Alpha'])
  })

  test('a pilot’s menu has no Save as pattern', async () => {
    await seedEntity('pilot', 'Kael Dusk')
    await renderShelves()

    const menu = await openMenu('Ghost · Kael Dusk')
    expect(within(menu).queryByRole('menuitem', { name: 'Save as pattern' })).toBeNull()
  })
})

describe('Training Bay — Make a copy', () => {
  test('copies at once, with no confirm, and puts a separate copy on the shelf', async () => {
    await seedEntity('pilot', 'Fen Oya')
    await renderShelves()

    const menu = await openMenu('Ghost · Fen Oya')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Make a copy' }))
    })
    // A copy only adds, so nothing asks first.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await settle(() => screen.queryByText('Ghost 2 · Fen Oya 2') !== null)

    expect(screen.getByText('Ghost 2 · Fen Oya 2')).toBeTruthy()
    expect(screen.getByText('Ghost · Fen Oya')).toBeTruthy()
    const names = useUnits
      .getState()
      .list('pilot')
      .map((p) => p.name)
    expect(names.sort()).toEqual(['Fen Oya', 'Fen Oya 2'])
  })
})

describe('Training Bay — delete flow', () => {
  test('Delete… opens the confirm, naming the build', async () => {
    await seedEntity('pilot', 'Mira Cole')
    await renderShelves()

    const menu = await openMenu('Ghost · Mira Cole')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getAllByText(/Delete Ghost · Mira Cole/i).length).toBeGreaterThan(0)
  })

  test('confirming removes it from the shelf', async () => {
    await seedEntity('pilot', 'Tov Heln')
    await renderShelves()

    const menu = await openMenu('Ghost · Tov Heln')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    await settle(
      () => screen.queryAllByText('Ghost · Tov Heln').filter((n) => n.isConnected).length === 0
    )

    expect(screen.queryAllByText('Ghost · Tov Heln').filter((n) => n.isConnected)).toHaveLength(0)
  })

  test('cancelling leaves it where it was', async () => {
    await seedEntity('pilot', 'Fen Oya')
    await renderShelves()

    const menu = await openMenu('Ghost · Fen Oya')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete…' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(screen.getByText('Ghost · Fen Oya')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeFalsy()
  })
})
