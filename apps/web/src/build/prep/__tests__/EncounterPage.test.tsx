/**
 * EncounterPage and the Encounters shelf (ADR-059): an encounter's name,
 * opposition, tables and notes, each edit written through the prep store, and
 * the shelf's New, Make a copy and Delete.
 *
 * Rendered without a router, so `useGo` falls back to `location.assign`,
 * which is observed.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { ToasterMount, toast } = await import('../../../components/index')
const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { useEncounters } = await import('../../../replica/collections')
const { usePatterns } = await import('../../../replica/collections')
const { EncounterPage } = await import('../EncounterPage')
const { EncounterShelf } = await import('../../shelves/EncounterShelf')
const { useConfirm } = await import('../../../components/shared/useConfirm')
const { useSheetModeStore } = await import('../../sheet/sheetMode.model')
const { WritesBlockedOffline } = await import('../../../replica/sync')

withSignedInBackend()

const NOW = '2026-10-22T00:00:00.000Z'

const AMBUSH: Encounter = {
  id: 'enc-1',
  schemaVersion: 1,
  name: 'Ambush',
  opposition: [
    {
      id: 'o1',
      refSchema: 'npcs',
      refSlug: 'raider',
      refName: 'Raider',
      name: 'Raider',
      maxHp: 3,
      statKind: 'hp',
    },
  ],
  tables: ['Morale'],
  notes: 'Behind the crusher.',
  createdAt: NOW,
  updatedAt: NOW,
}

function connection(canWrite = true): SyncState {
  return {
    status: canWrite ? 'live' : 'offline',
    canWrite,
    outdated: false,
  }
}

let assigned: string[] = []
let assignSpy: ReturnType<typeof spyOn> | null = null

beforeEach(() => {
  // The sheet names the Games its reader runs (the For field).
  setQueryAnswers({ 'games.listMine': [] })
  // Edit, where the writes are; Read is its own test.
  useSheetModeStore.setState({ editing: true })
  assigned = []
  assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  toast.dismiss()
  resetStores()
  useEncounters.setState({ encounters: [AMBUSH], hydrated: true } as never)
  usePatterns.setState({ mechPatterns: [], hydrated: true })
})

afterEach(() => {
  assignSpy?.mockRestore()
  toast.dismiss()
})

/** Let queued writes and their re-renders land. */
async function settle(done: () => boolean = () => false): Promise<void> {
  for (let i = 0; i < 40 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

const current = () => useEncounters.getState().get('enc-1')

async function renderPage(id = 'enc-1', canWrite = true) {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(canWrite)}>
        <ToasterMount />
        <EncounterPage id={id} />
      </SyncContext.Provider>
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

/** Open an edit-in-place Field, type into it, and press Enter. */
async function editField(label: string, value: string) {
  await click(screen.getByRole('button', { name: `Edit ${label}` }))
  const input = screen.getByLabelText(new RegExp(label, 'i'), {
    selector: 'input, textarea',
  }) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { value } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
  await settle()
}

describe('an encounter page', () => {
  // MD3-10: a unit could not be opened to read what it does, in Edit or in Read.
  test('a unit’s name opens its card on the page, in Edit and in Read', async () => {
    await renderPage()
    const row = within(screen.getByRole('list', { name: 'Opposition' }))
    await click(row.getByRole('button', { name: 'Raider' }))
    const card = screen.getByRole('dialog', { name: /Raider/ })
    expect(within(card).getAllByText(/Raider/).length).toBeGreaterThan(0)
    cleanup()

    useSheetModeStore.setState({ editing: false })
    await renderPage()
    await click(
      within(screen.getByRole('list', { name: 'Opposition' })).getByRole('button', {
        name: 'Raider',
      })
    )
    expect(screen.getByRole('dialog', { name: /Raider/ })).toBeTruthy()
  })

  // MD-18: every row read "(NPC)" after its name, whatever it was.
  test('a row says its name once, with no "(NPC)" after it', async () => {
    await renderPage()
    const list = screen.getByRole('list', { name: 'Opposition' })
    expect(list.textContent).not.toContain('(NPC)')
  })

  test('an unknown encounter says so and leads back to the Mediator’s Kit', async () => {
    await renderPage('missing')
    expect(screen.getByText('Encounter not found')).toBeTruthy()
    // The back button says "Back to" itself: once (MD2-19).
    expect(screen.getByRole('link', { name: 'Back to Mediator’s Kit' })).toBeTruthy()
  })

  // MD-02: every encounter's tab read "Encounter · Training Bay".
  test('its tab names the encounter, in the Mediator’s Kit', async () => {
    await renderPage()
    expect(document.title).toBe('Ambush · Mediator’s Kit · SalvageUnion.io')
  })

  test('it shows the opposition, the pinned tables and the private notes', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Ambush (Encounter)' })).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Opposition' })).getByText('Raider')
    ).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Pinned tables' })).getByText('Morale')
    ).toBeTruthy()
    expect(screen.getByText('Behind the crusher.')).toBeTruthy()
    expect(screen.getByText('Only you')).toBeTruthy()
  })

  test('read-only, it offers no edits', async () => {
    await renderPage('enc-1', false)
    expect(screen.queryByRole('button', { name: 'Add opposition from the reference' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByLabelText('Pin a table')).toBeNull()
  })

  test('renaming saves a trimmed name and refuses a blank one', async () => {
    await renderPage()
    await editField('name', '  Scrap Yard Ambush  ')
    expect(current()?.name).toBe('Scrap Yard Ambush')
    await editField('name', '   ')
    expect(current()?.name).toBe('Scrap Yard Ambush')
  })

  test('notes save as written', async () => {
    await renderPage()
    await editField('your notes', 'Raiders on the gantry.')
    expect(current()?.notes).toBe('Raiders on the gantry.')
  })

  test('a table is pinned from the search and unpinned from its open view', async () => {
    await renderPage()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Pin a table'), { target: { value: 'Reaction' } })
    })
    const found = screen.getByRole('list', { name: 'Tables found' })
    await click(within(found).getAllByRole('button')[0] as HTMLElement)
    await settle(() => (current()?.tables.length ?? 0) > 1)
    expect(current()?.tables[0]).toBe('Morale')
    expect(current()?.tables).toHaveLength(2)

    const pinned = screen.getByRole('list', { name: 'Pinned tables' })
    await click(within(pinned).getByRole('button', { name: /Morale/ }))
    await click(screen.getByRole('button', { name: 'Unpin Morale' }))
    await settle(() => !current()?.tables.includes('Morale'))
    expect(current()?.tables).not.toContain('Morale')
  })

  test('an opponent is removed from its ⋯ menu', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'More for Raider' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }))
    await settle(() => current()?.opposition.length === 0)
    expect(current()?.opposition).toEqual([])
    expect(screen.getByText(/No opposition yet/)).toBeTruthy()
  })

  // MD2-20: it went at once, with no word and no way back.
  test('a removed opponent comes back where it stood on Undo', async () => {
    await renderPage()
    const before = current()?.opposition
    await click(screen.getByRole('button', { name: 'More for Raider' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }))
    await settle(() => current()?.opposition.length === 0)
    expect(await screen.findByText('Removed Raider.')).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Undo' }))
    await settle(() => current()?.opposition.length === 1)
    expect(current()?.opposition).toEqual(before)
  })

  test('an opponent is renamed from its ⋯ menu', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'More for Raider' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Rename…' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Rename Raider' })
    await act(async () => {
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Red Leader' } })
    })
    await click(within(dialog).getByRole('button', { name: 'Rename' }))
    await settle(() => current()?.opposition[0]?.name === 'Red Leader')
    expect(current()?.opposition[0]?.name).toBe('Red Leader')
  })

  test('+ Add fields an opponent from the reference', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'Add opposition from the reference' }))
    const picker = screen.getByRole('dialog', { name: 'Add opposition from the reference' })
    const raider = picker.querySelector('[data-searcher-open="raider"]') as HTMLElement
    await click(raider)
    await click(within(picker).getAllByRole('button', { name: /^Add/ })[0] as HTMLElement)
    await settle(() => current()?.opposition.length === 2)
    expect(current()?.opposition.map((o) => o.name)).toEqual(['Raider', 'Raider 2'])
  })

  test('Read prints the encounter: no edits, its empty sections left out', async () => {
    useSheetModeStore.setState({ editing: false })
    useEncounters.setState({ encounters: [{ ...AMBUSH, notes: '' }] } as never)
    await renderPage()
    expect(screen.getByRole('button', { name: 'Sheet', pressed: true })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add opposition from the reference' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More for Raider' })).toBeNull()
    expect(screen.queryByLabelText('Pin a table')).toBeNull()
    expect(screen.queryByText('Notes')).toBeNull()
    expect(
      within(screen.getByRole('list', { name: 'Opposition' })).getByText('Raider')
    ).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'Add opposition from the reference' })).toBeTruthy()
    expect(screen.getByText('Notes')).toBeTruthy()
  })

  test('a refused edit is told once and leaves no unhandled rejection', async () => {
    // The collection's api is the prototype of every state the store hands out.
    const api = Object.getPrototypeOf(useEncounters.getState())
    const refuse = spyOn(api, 'update').mockImplementation(async () => {
      throw new WritesBlockedOffline()
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      await renderPage()
      await click(screen.getByRole('button', { name: 'More for Raider' }))
      await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Remove' }))
      await editField('your notes', 'Raiders on the gantry.')
      await settle(() => refuse.mock.calls.length >= 2)
      // One macrotask, so a rejection with no handler has been reported.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(refuse.mock.calls.length).toBe(2)
      expect(unhandled).toEqual([])
      expect(current()?.opposition).toHaveLength(1)
    } finally {
      process.off('unhandledRejection', onUnhandled)
      refuse.mockRestore()
    }
  })

  test('Delete, under the corner ⋯, asks first, then returns to the Mediator’s Kit', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'More actions' }))
    await click(screen.getByRole('button', { name: 'Delete Ambush' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await settle(() => assigned.length > 0)
    expect(current()).toBeNull()
    expect(assigned).toEqual(['/games/#mediators-kit'])
  })
})

function ShelfHarness() {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <EncounterShelf confirm={confirm} />
      {dialog}
    </>
  )
}

async function renderShelf() {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection()}>
        <ToasterMount />
        <ShelfHarness />
      </SyncContext.Provider>
    )
  })
  await settle()
}

describe('the Encounters shelf', () => {
  test('+ New encounter makes a blank one and opens it in Edit', async () => {
    useSheetModeStore.setState({ editing: false })
    await renderShelf()
    await click(screen.getByRole('button', { name: '+ New encounter' }))
    await settle(() => assigned.length > 0)
    const made = useEncounters.getState().encounters.find((e) => e.id !== 'enc-1')
    expect(made?.name).toBe('New encounter')
    expect(assigned).toEqual([`/encounters/${made?.id}`])
    expect(useSheetModeStore.getState().editing).toBe(true)
  })

  test('Make a copy runs at once, and its toast opens the copy (SB-25)', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Make a copy' }))
    // No confirm stands between the press and the copy.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await settle(() => useEncounters.getState().encounters.length === 2)
    const copy = useEncounters.getState().encounters.find((e) => e.id !== 'enc-1')
    expect(copy?.name).toBe('Ambush 2')
    await settle(() => screen.queryByRole('button', { name: 'Open the copy' }) !== null)
    await click(screen.getByRole('button', { name: 'Open the copy' }))
    expect(assigned).toEqual([`/encounters/${copy?.id}`])
  })

  test('a second copy is numbered', async () => {
    await renderShelf()
    for (const expected of [2, 3]) {
      await click(screen.getByRole('button', { name: 'More for Ambush' }))
      await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Make a copy' }))
      await settle(() => useEncounters.getState().encounters.length === expected)
    }
    expect(
      useEncounters
        .getState()
        .encounters.map((e) => e.name)
        .sort()
    ).toEqual(['Ambush', 'Ambush 2', 'Ambush 3'])
  })

  test('Delete asks, then takes it off the shelf', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete…' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await settle(() => useEncounters.getState().encounters.length === 0)
    expect(useEncounters.getState().encounters).toEqual([])
    expect(screen.getByText('No encounters yet. Prep one before the session.')).toBeTruthy()
  })

  test('Open goes to the encounter page', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Open' }))
    expect(assigned).toEqual(['/encounters/enc-1'])
  })
})
