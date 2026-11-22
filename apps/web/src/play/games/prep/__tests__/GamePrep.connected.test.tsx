/**
 * A Game's Prep (`/games/<gameId>/prep`, ADR-067 §3-4): who may open it, the
 * Game's encounters in their planned order with the moves that reorder them,
 * taking one in from the Mediator's Kit and out again, the NPCs designed for
 * the Game, and the plan (notes and dated sessions) saved to the Game's room.
 *
 * Reads are answered by name (`serverMock.ts`); `plan.set` is recorded.
 * Rendered without a router, so `useGo` falls back to `location.assign`.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import type { GamePlan } from 'game-domain/schemas/gamePlan'
import { npcFixture } from '../../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'

const saves: GamePlan[] = []
let saveError: unknown = null

const serverMocks = await installServerMocks({
  call: (name, args) => {
    if (name !== 'plan.set') return undefined
    if (saveError !== null) throw saveError
    saves.push((args as { plan: GamePlan }).plan)
    return undefined
  },
})
afterAll(() => serverMocks.restore())

const { ToasterMount } = await import('../../../../components/index')
const { SyncContext } = await import('../../../../replica/syncContext')
const { resetStores } = await import('../../../../replica/__tests__/resetStores')
const { useEncounters } = await import('../../../../replica/collections')
const { useUnits } = await import('../../../../replica/units')
const { hydrateStores } = await import('../../../../components/__tests__/hydrateStores')
const { useSheetModeStore } = await import('../../../../build/sheet/sheetMode.model')
const { GamePrep } = await import('../GamePrep')

withSignedInBackend()

const NOW = '2026-10-22T00:00:00.000Z'

function encounter(id: string, name: string, more: Partial<Encounter> = {}): Encounter {
  return {
    id,
    schemaVersion: 1,
    name,
    opposition: [],
    tables: [],
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...more,
  }
}

const GAME = { _id: 'g1', name: 'Rust Road', mediator: true, tableRunner: true }
const PLAN: GamePlan = {
  schemaVersion: 1,
  notes: 'The bridge is out.',
  sessions: [
    { id: 's-late', date: '2026-12-05', title: 'The Crusher', note: 'Kessler turns.' },
    { id: 's-early', date: '2026-11-28', note: '' },
  ],
}

let assigned: string[] = []
let assignSpy: ReturnType<typeof spyOn> | null = null

beforeEach(async () => {
  saves.length = 0
  saveError = null
  assigned = []
  assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  resetStores()
  await hydrateStores()
  useSheetModeStore.setState({ editing: false })
  useEncounters.setState({
    encounters: [
      encounter('e-two', 'Ambush', { gameId: 'g1', order: 2, tables: ['Morale'] }),
      encounter('e-one', 'Toll Gate', { gameId: 'g1', order: 1 }),
      encounter('e-three', 'Crusher', { gameId: 'g1', order: 3 }),
      encounter('e-loose', 'Loose Raid'),
      encounter('e-loose-2', 'Loose Storm'),
      encounter('e-other', 'Elsewhere', { gameId: 'g2', order: 1 }),
    ],
    hydrated: true,
  } as never)
  setQueryAnswers({ 'games.get': GAME, 'plan.get': PLAN })
})

afterEach(() => {
  assignSpy?.mockRestore()
})

async function renderPrep(canWrite = true) {
  await act(async () => {
    render(
      <SyncContext.Provider
        value={{ status: canWrite ? 'live' : 'offline', canWrite, outdated: false }}
      >
        <ToasterMount />
        <GamePrep gameId="g1" />
      </SyncContext.Provider>
    )
  })
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

/** Let queued writes and their re-renders land. */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 40 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

const stored = (id: string) => useEncounters.getState().get(id)
const encounterRows = () =>
  within(screen.getByRole('region', { name: /Encounters/ }))
    .getAllByRole('link')
    .map((a) => a.textContent)

async function choose(encounterName: string, item: string) {
  await click(screen.getByRole('button', { name: `More for ${encounterName}` }))
  await click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
}

describe('who may open a Game’s Prep', () => {
  test('while the Game loads it waits, with the way back to the Game', async () => {
    setQueryAnswers({ 'games.get': undefined })
    await renderPrep()
    expect(screen.getByRole('heading', { level: 1, name: 'Prep' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Game' }).getAttribute('href')).toBe(
      '/games/g1'
    )
    expect(screen.queryByRole('link', { name: 'Mediate' })).toBeNull()
    expect(screen.queryByText('Game notes')).toBeNull()
  })

  test('a member who does not run the table is sent back to the Game', async () => {
    setQueryAnswers({ 'games.get': { ...GAME, mediator: false, tableRunner: false } })
    await renderPrep()
    expect(screen.getByText(/A Game’s Prep is its Mediator’s/)).toBeTruthy()
    const back = screen.getAllByRole('link', { name: 'Back to Game' })
    expect(back.every((a) => a.getAttribute('href') === '/games/g1')).toBe(true)
    expect(screen.queryByText('Game notes')).toBeNull()
  })

  test('a Game that is gone sends its reader back to Play', async () => {
    setQueryAnswers({ 'games.get': null })
    await renderPrep()
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/games')
  })

  test('its Mediator gets the page, named for the Game, with the door to Mediate', async () => {
    await renderPrep()
    expect(screen.getByRole('heading', { level: 1, name: 'Rust Road · Prep' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mediate' }).getAttribute('href')).toBe(
      '/games/g1/mediate'
    )
    expect(screen.getByRole('complementary', { name: 'The plan' })).toBeTruthy()
  })
})

describe('a Game’s encounters', () => {
  test('are this Game’s only, in their planned order', async () => {
    await renderPrep()
    expect(encounterRows()).toEqual(['Toll Gate', 'Ambush', 'Crusher'])
    expect(screen.queryByRole('link', { name: 'Elsewhere' })).toBeNull()
  })

  test('Move down swaps an encounter with the one after it', async () => {
    await renderPrep()
    await choose('Toll Gate', 'Move down')
    await settle(() => stored('e-one')?.order === 2)
    expect(stored('e-one')?.order).toBe(2)
    expect(stored('e-two')?.order).toBe(1)
    expect(stored('e-three')?.order).toBe(3)
    expect(encounterRows()).toEqual(['Ambush', 'Toll Gate', 'Crusher'])
  })

  test('Move up swaps it with the one before, and the ends offer no move past them', async () => {
    await renderPrep()
    await choose('Crusher', 'Move up')
    await settle(() => stored('e-three')?.order === 2)
    expect(encounterRows()).toEqual(['Toll Gate', 'Crusher', 'Ambush'])

    await click(screen.getByRole('button', { name: 'More for Toll Gate' }))
    const first = within(screen.getByRole('menu'))
    expect(first.getByRole('menuitem', { name: 'Move up' }).getAttribute('aria-disabled')).toBe(
      'true'
    )
  })

  // MD2-20: it went at once, with no word and no way back.
  test('Take out of this Game says so, and Undo puts it back in its place', async () => {
    await renderPrep()
    const before = encounterRows()
    await choose('Ambush', 'Take out of this Game')
    await settle(() => stored('e-two')?.gameId === undefined)
    expect(await screen.findByText('Took Ambush out of this Game.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    await settle(() => stored('e-two')?.gameId === 'g1')
    expect(encounterRows()).toEqual(before)
  })

  test('Take out of this Game returns one to the Kit, where it can be added back last', async () => {
    await renderPrep()
    await choose('Ambush', 'Take out of this Game')
    await settle(() => stored('e-two')?.gameId === undefined)
    expect(stored('e-two')?.gameId).toBeUndefined()
    expect(stored('e-two')?.order).toBeUndefined()
    expect(encounterRows()).toEqual(['Toll Gate', 'Crusher'])

    const kit = screen.getByLabelText('From your Mediator’s Kit') as HTMLSelectElement
    expect([...kit.options].map((o) => o.textContent)).toEqual([
      'Ambush',
      'Loose Raid',
      'Loose Storm',
    ])
    await act(async () => {
      fireEvent.change(kit, { target: { value: 'e-loose-2' } })
    })
    await click(screen.getByRole('button', { name: 'Add to this Game' }))
    await settle(() => stored('e-loose-2')?.gameId === 'g1')
    expect(stored('e-loose-2')).toMatchObject({ gameId: 'g1', order: 4 })
    expect(encounterRows()).toEqual(['Toll Gate', 'Crusher', 'Loose Storm'])
    // The choice falls back to the first one still loose.
    expect((screen.getByLabelText('From your Mediator’s Kit') as HTMLSelectElement).value).toBe(
      'e-two'
    )
  })

  test('Open goes to the encounter', async () => {
    await renderPrep()
    await choose('Ambush', 'Open')
    expect(assigned).toEqual(['/encounters/e-two'])
  })

  test('+ New encounter makes one for this Game, last, and opens it in Edit', async () => {
    await renderPrep()
    await click(screen.getByRole('button', { name: '+ New encounter' }))
    await settle(() => assigned.length > 0)
    const made = useEncounters
      .getState()
      .encounters.find((e) => !e.id.startsWith('e-')) as Encounter
    expect(made).toMatchObject({ gameId: 'g1', order: 4 })
    expect(assigned).toEqual([`/encounters/${made.id}`])
    expect(useSheetModeStore.getState().editing).toBe(true)
  })

  test('read-only, nothing is offered that would write', async () => {
    await renderPrep(false)
    expect(screen.queryByRole('button', { name: '+ New encounter' })).toBeNull()
    expect(screen.queryByLabelText('From your Mediator’s Kit')).toBeNull()
    await click(screen.getByRole('button', { name: 'More for Ambush' }))
    const menu = within(screen.getByRole('menu'))
    for (const name of ['Move up', 'Move down', 'Take out of this Game']) {
      expect(menu.getByRole('menuitem', { name }).getAttribute('aria-disabled')).toBe('true')
    }
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '+ Add a session' })).toHaveProperty('disabled', true)
  })
})

describe('a Game’s NPCs', () => {
  test('lists the NPCs designed for this Game, not another’s', async () => {
    await act(async () => {
      const store = useUnits.getState()
      await store.adopt(
        'npc',
        npcFixture({ id: 'n-here', name: 'Kessler', gameId: 'g1', position: 'Sergeant' })
      )
      await store.adopt('npc', npcFixture({ id: 'n-there', name: 'Voss', gameId: 'g2' }))
    })
    await renderPrep()
    const npcs = within(screen.getByRole('region', { name: /NPCs/ }))
    expect(npcs.getByRole('link', { name: /Kessler/ }).getAttribute('href')).toBe('/npcs/n-here')
    expect(npcs.getByText('Sergeant')).toBeTruthy()
    expect(npcs.queryByText('Voss')).toBeNull()
    expect(npcs.getByRole('link', { name: '+ Design an NPC' }).getAttribute('href')).toBe(
      '/npcs/new?game=g1'
    )
  })
})

describe('the plan', () => {
  const sessionDays = () =>
    within(screen.getByRole('list', { name: 'Sessions' }))
      .getAllByLabelText('Day')
      .map((input) => (input as HTMLInputElement).value)

  test('shows the kept notes and the sessions soonest first', async () => {
    await renderPrep()
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('The bridge is out.')
    expect(sessionDays()).toEqual(['2026-11-28', '2026-12-05'])
    expect(screen.getByRole('button', { name: 'Remove The Crusher' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove 2026-11-28' })).toBeTruthy()
  })

  test('while the plan loads the notes wait and no session can be added', async () => {
    setQueryAnswers({ 'games.get': GAME, 'plan.get': undefined })
    await renderPrep()
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '+ Add a session' })).toHaveProperty('disabled', true)
    expect(screen.queryByText(/No sessions yet/)).toBeNull()
  })

  test('a Game with no plan yet says there are no sessions', async () => {
    setQueryAnswers({ 'games.get': GAME, 'plan.get': null })
    await renderPrep()
    expect(screen.getByText(/No sessions yet/)).toBeTruthy()
  })

  test('typing saves nothing until the field is left', async () => {
    await renderPrep()
    const notes = screen.getByLabelText('Notes')
    await act(async () => {
      fireEvent.change(notes, { target: { value: 'The bridge holds.' } })
    })
    expect(saves).toEqual([])
    await act(async () => {
      fireEvent.blur(notes)
    })
    await settle(() => saves.length > 0)
    expect(saves).toEqual([{ ...PLAN, notes: 'The bridge holds.' }])
  })

  test('leaving a field untouched saves nothing', async () => {
    await renderPrep()
    await act(async () => {
      fireEvent.blur(screen.getByLabelText('Notes'))
    })
    expect(saves).toEqual([])
  })

  test('a session’s day, title and note are each saved on leaving the field', async () => {
    await renderPrep()
    const early = within(
      within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole(
        'listitem'
      )[0] as HTMLElement
    )
    const edit = async (label: string, value: string) => {
      const field = early.getByLabelText(label)
      await act(async () => {
        fireEvent.change(field, { target: { value } })
        fireEvent.blur(field)
      })
    }
    await edit('Title', 'Toll Gate')
    await edit('Private note', 'They pay or fight.')
    await edit('Day', '2026-12-12')
    await settle(() => saves.length === 3)
    expect(saves.at(-1)?.sessions.find((s) => s.id === 's-early')).toEqual({
      id: 's-early',
      date: '2026-12-12',
      title: 'Toll Gate',
      note: 'They pay or fight.',
    })
    // Its new day puts it after the other session.
    expect(sessionDays()).toEqual(['2026-12-05', '2026-12-12'])
  })

  // MD2-06: the list re-sorted under the cursor, so the next field belonged to another session.
  test('a new day does not move a session until its form is left, and each form is numbered', async () => {
    await renderPrep()
    const items = () =>
      within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole('listitem')
    expect(items().map((li) => within(li).getByRole('heading').textContent)).toEqual([
      'Session 1',
      'Session 2',
    ])
    const early = within(items()[0] as HTMLElement)
    const day = early.getByLabelText('Day')
    // To the title beside it: the same form.
    await act(async () => {
      fireEvent.focus(day)
    })
    await act(async () => {
      fireEvent.change(day, { target: { value: '2026-12-12' } })
      fireEvent.blur(day, { relatedTarget: early.getByLabelText('Title') })
    })
    await settle(() => saves.length === 1)
    expect(sessionDays()).toEqual(['2026-12-12', '2026-12-05'])
    // Out of the form: now it takes its place.
    await act(async () => {
      fireEvent.blur(early.getByLabelText('Title'), { relatedTarget: document.body })
    })
    expect(sessionDays()).toEqual(['2026-12-05', '2026-12-12'])
  })

  // MD3-07: it took today's day, so it jumped above the planned ones as "Session 1".
  test('+ Add a session saves a new one after the last, numbered next and in view', async () => {
    const shown: Element[] = []
    const scroll = spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element
    ) {
      shown.push(this)
    })
    try {
      await renderPrep()
      await click(screen.getByRole('button', { name: '+ Add a session' }))
      await settle(() => saves.length > 0)
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const day = today > '2026-12-06' ? today : '2026-12-06'
      expect(saves).toHaveLength(1)
      expect(saves[0]?.sessions).toHaveLength(3)
      expect(saves[0]?.sessions[2]).toMatchObject({ date: day, note: '' })
      expect(sessionDays()).toEqual(['2026-11-28', '2026-12-05', day])
      const rows = within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole('listitem')
      expect(
        within(rows[2] as HTMLElement).getByRole('heading', { name: 'Session 3' })
      ).toBeTruthy()
      expect(shown).toEqual([rows[2] as Element])
    } finally {
      scroll.mockRestore()
    }
  })

  test('removing a session asks first, and Cancel keeps it', async () => {
    await renderPrep()
    await click(screen.getByRole('button', { name: 'Remove The Crusher' }))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(dialog.getAllByText('Remove The Crusher?').length).toBeGreaterThan(0)
    expect(dialog.getByText(/removed for good/)).toBeTruthy()
    await click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(saves).toEqual([])
    expect(sessionDays()).toEqual(['2026-11-28', '2026-12-05'])
  })

  test('confirmed, the session is removed and the plan saved without it', async () => {
    await renderPrep()
    await click(screen.getByRole('button', { name: 'Remove The Crusher' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    await settle(() => saves.length > 0)
    expect(saves).toEqual([{ ...PLAN, sessions: PLAN.sessions.slice(1) }])
    expect(sessionDays()).toEqual(['2026-11-28'])
  })

  test('a remove that fails keeps the dialog open with a reason', async () => {
    saveError = new Error('socket closed')
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    await renderPrep()
    await click(screen.getByRole('button', { name: 'Remove The Crusher' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    await settle(() => screen.queryByText('That did not work. Try again.') !== null)
    expect(
      within(screen.getByRole('alertdialog')).getByText('That did not work. Try again.')
    ).toBeTruthy()
    errors.mockRestore()
  })
})
