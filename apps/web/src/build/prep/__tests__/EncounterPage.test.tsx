/**
 * EncounterPage and the Encounters shelf (ADR-059): an encounter's name,
 * opposition, tables and notes, each edit written through the prep store, and
 * the shelf's New, Make a copy and Delete.
 *
 * Rendered without a router, so `useGo` falls back to `location.assign`,
 * which is observed.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import { installConvexMocks } from '../../../components/__tests__/convexMock'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})
afterAll(() => convexMocks.restore())

const { ToasterMount, toast } = await import('../../../components/index')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { resetStores } = await import('../../../stores/__tests__/resetStores')
const { usePrepStore } = await import('../../../stores/prepStore')
const { usePatternStore } = await import('../../../stores/patternStore')
const { EncounterPage } = await import('../EncounterPage')
const { EncounterShelf } = await import('../../shelves/EncounterShelf')
const { useConfirm } = await import('../../../components/shared/useConfirm')

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

function connection(canWrite = true): ConnectionState {
  return {
    mode: canWrite ? 'connected' : 'disconnected',
    canWrite,
    showDisconnectedWarning: false,
    settling: false,
  }
}

let assigned: string[] = []
let assignSpy: ReturnType<typeof spyOn> | null = null

beforeEach(() => {
  assigned = []
  assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  toast.dismiss()
  resetStores()
  usePrepStore.setState({ encounters: [AMBUSH], hydrated: true } as never)
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
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

const current = () => usePrepStore.getState().get('enc-1')

async function renderPage(id = 'enc-1', canWrite = true) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(canWrite)}>
        <ToasterMount />
        <EncounterPage id={id} />
      </ConnectionContext.Provider>
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
  test('an unknown encounter says so and leads back to the Training Bay', async () => {
    await renderPage('missing')
    expect(screen.getByText('Encounter not found')).toBeTruthy()
    expect(screen.getByText('Back to the Training Bay')).toBeTruthy()
  })

  test('it shows the opposition, the pinned tables and the private notes', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Ambush' })).toBeTruthy()
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

  test('Delete asks first, then returns to the Training Bay', async () => {
    await renderPage()
    await click(screen.getByRole('button', { name: 'Delete' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await settle(() => assigned.length > 0)
    expect(current()).toBeNull()
    expect(assigned).toEqual(['/'])
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
      <ConnectionContext.Provider value={connection()}>
        <ToasterMount />
        <ShelfHarness />
      </ConnectionContext.Provider>
    )
  })
  await settle()
}

describe('the Encounters shelf', () => {
  test('+ New encounter makes a blank one and opens it', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: '+ New encounter' }))
    await settle(() => assigned.length > 0)
    const made = usePrepStore.getState().encounters.find((e) => e.id !== 'enc-1')
    expect(made?.name).toBe('New encounter')
    expect(assigned).toEqual([`/encounters/${made?.id}`])
  })

  test('Make a copy asks, then shelves the copy', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Make a copy' }))
    const dialog = screen.getByRole('alertdialog')
    await click(within(dialog).getAllByRole('button').at(-1) as HTMLElement)
    await settle(() => usePrepStore.getState().encounters.length === 2)
    expect(usePrepStore.getState().encounters).toHaveLength(2)
  })

  test('Delete asks, then takes it off the shelf', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Delete…' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await settle(() => usePrepStore.getState().encounters.length === 0)
    expect(usePrepStore.getState().encounters).toEqual([])
    expect(screen.getByText('No encounters yet. Prep one before the session.')).toBeTruthy()
  })

  test('Open goes to the encounter page', async () => {
    await renderShelf()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Open' }))
    expect(assigned).toEqual(['/encounters/enc-1'])
  })
})
