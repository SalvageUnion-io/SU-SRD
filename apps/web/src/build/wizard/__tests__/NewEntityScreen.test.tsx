/**
 * NewEntityScreen + CreateModeChooser + BlankCreateDialog: mode
 * routing renders chooser vs wizard vs blank dialog, the
 * chooser doors fire their callbacks, and the Blank dialog persists a
 * schema-valid entity through createBlank.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument().
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { PilotSchema } from 'game-domain/schemas/pilot'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import { parseCreateMode } from '../../../lib/wizard/createMode'
import { wizardDraftKey } from '../../../lib/wizard/wizardDraft'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`. The signed-out
// panel mounts `SignInControl`, whose auth hook needs the auth module.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')
const { usePatterns } = await import('../../../replica/collections')
const { NewEntityScreen } = await import('../NewEntityScreen')
const { useSheetModeStore } = await import('../../sheet/sheetMode.model')

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

function Connected({ children }: { children: ReactNode }) {
  return <SyncContext.Provider value={CONNECTED}>{children}</SyncContext.Provider>
}

/** Every render here is signed in, unless a test renders Solo on purpose. */
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: Connected })

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  cleanup()
  resetStores()
})

const noop = () => {}

describe('parseCreateMode', () => {
  test('narrows valid modes and drops anything else', () => {
    expect(parseCreateMode('guided')).toBe('guided')
    expect(parseCreateMode('blank')).toBe('blank')
    expect(parseCreateMode('nonsense')).toBeUndefined()
    expect(parseCreateMode(undefined)).toBeUndefined()
    expect(parseCreateMode(42)).toBeUndefined()
  })
})

describe('NewEntityScreen — signed out', () => {
  // Outside any provider the connection is Solo.
  const signedOut = (mode: 'guided' | 'blank' | undefined, kind: 'mech' | 'npc' = 'mech') =>
    rtlRender(
      <NewEntityScreen
        kind={kind}
        mode={mode}
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )

  test('the chooser and the guided wizard run without an account (SB-06, PT-23)', async () => {
    signedOut(undefined)
    expect(await screen.findByRole('button', { name: /guided/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Sign in to build a mech' })).toBeNull()
    cleanup()
    signedOut('guided')
    expect(await screen.findByTestId('stub-wizard')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Sign in to build a mech' })).toBeNull()
  })

  test('what is written at once asks for the account first: a blank sheet, an NPC', () => {
    signedOut('blank')
    expect(screen.getByRole('heading', { name: 'Sign in to build a mech' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    signedOut('guided', 'npc')
    expect(screen.getByRole('heading', { name: 'Sign in to build an NPC' })).toBeTruthy()
    expect(screen.queryByTestId('stub-wizard')).toBeNull()
  })
})

describe('NewEntityScreen — the gate’s landmark', () => {
  // A page's leading band, first in `<main>`, sets its kind
  // (`unionBarMatch.ts`). The screen draws the one its gate leads,
  // for every kind: the routes draw none.
  test('every gate is its own <main>', () => {
    for (const kind of ['npc', 'mech'] as const) {
      rtlRender(
        <NewEntityScreen
          kind={kind}
          mode={undefined}
          wizard={null}
          onModeChange={noop}
          onCreated={noop}
        />
      )
      expect(screen.queryAllByRole('main')).toHaveLength(1)
      cleanup()
    }
  })
})

describe('NewEntityScreen — signed out, deep-linked', () => {
  test("signing in comes back to the route's own URL, so the preselection survives", async () => {
    serverMocks.signIns.length = 0
    rtlRender(
      <NewEntityScreen
        kind="mech"
        mode="blank"
        returnTo="/mechs/new?mode=blank&chassis=mule"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }))
    })
    expect(serverMocks.signIns).toEqual([['/mechs/new?mode=blank&chassis=mule']])
  })
})

describe('NewEntityScreen — mode routing', () => {
  test('mode absent renders the chooser, not the wizard or dialog', () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode={undefined}
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.getByRole('heading', { name: /new pilot/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /guided/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /blank/i })).toBeTruthy()
    expect(screen.queryByTestId('stub-wizard')).toBeFalsy()
    expect(screen.queryByRole('dialog')).toBeFalsy()
  })

  test("mode 'guided' renders the wizard slot unchanged, no chooser", () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode="guided"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.getByTestId('stub-wizard')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /new pilot/i })).toBeFalsy()
  })

  test("mode 'blank' opens the blank dialog over the chooser", () => {
    const { container } = render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    // The chooser stays mounted underneath (base-ui inerts it while the
    // modal is open, so query structurally rather than by role).
    expect(container.querySelector('.su-sheet--pilot')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText(/callsign/i)).toBeTruthy()
  })

  test('chooser doors fire onModeChange with the chosen mode', () => {
    const calls: Array<'guided' | 'blank' | undefined> = []
    render(
      <NewEntityScreen
        kind="crawler"
        mode={undefined}
        wizard={null}
        onModeChange={(next) => calls.push(next)}
        onCreated={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /guided/i }))
    fireEvent.click(screen.getByRole('button', { name: /blank/i }))
    expect(calls).toEqual(['guided', 'blank'])
  })
})

describe('CreateModeChooser — the mech’s From a pattern door', () => {
  const order = () => {
    const [pattern, guided, blank] = ['From a pattern', 'Guided', 'Blank'].map((t) =>
      screen.getByRole('heading', { name: t })
    )
    const before = (a?: Node, b?: Node) =>
      Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    return {
      patternFirst: before(pattern, guided),
      guidedFirst: before(guided, blank),
      patternLast: before(blank, pattern),
    }
  }
  const chooser = () =>
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
        forPilot="Nia Vale"
      />
    )

  test('with a pattern saved, a mech chooser opens on From a pattern, then Guided and Blank, and names the pilot', () => {
    usePatterns.setState({
      mechPatterns: [
        {
          id: 'pat-1',
          schemaVersion: 1,
          name: 'Brawler',
          chassisRef: 'titan',
          systems: [],
          modules: [],
          createdAt: 0,
        },
      ],
      hydrated: true,
    })
    chooser()
    expect(order()).toMatchObject({ patternFirst: true, guidedFirst: true })
    expect(screen.getByText(/For Nia Vale/)).toBeTruthy()
  })

  test('with none saved, its empty pattern door waits under Guided and Blank', () => {
    usePatterns.setState({ mechPatterns: [], hydrated: true })
    chooser()
    expect(order()).toMatchObject({ guidedFirst: true, patternLast: true })
  })

  test('pilot and crawler choosers do NOT show the pattern door', () => {
    const { unmount } = render(
      <NewEntityScreen
        kind="pilot"
        mode={undefined}
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.queryByText('From a pattern')).toBeNull()
    unmount()

    render(
      <NewEntityScreen
        kind="crawler"
        mode={undefined}
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.queryByText('From a pattern')).toBeNull()
  })
})

describe('BlankCreateDialog — blank pilot create', () => {
  test('requires name + callsign, then persists a schema-valid pilot and reports its id', async () => {
    const created: string[] = []
    render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
      />
    )

    const submit = screen.getByRole('button', { name: 'Create Pilot' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Juno Vale' } })
    fireEvent.change(screen.getByLabelText(/callsign/i), { target: { value: 'Nomad' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => expect(created.length).toBe(1))

    const pilot = useUnits.getState().get('pilot', created[0] as string)
    expect(() => PilotSchema.parse(pilot)).not.toThrow()
    expect(pilot?.name).toBe('Juno Vale')
    expect(pilot?.callsign).toBe('Nomad')
    expect(pilot?.classRef).toBe('')
  })

  test('class pick is UNFILTERED — every class incl. specialisations is offered', () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    const select = screen.getByLabelText<HTMLSelectElement>(/class \(optional\)/i)
    // "None" + the complete class catalog, nothing filtered out.
    expect(select.options.length).toBe(SalvageUnionReference.Classes.all().length + 1)
  })

  test('blank mech: every chassis is a Ledger row, the name waits, and the sheet opens in Edit', async () => {
    const created: string[] = []
    useSheetModeStore.getState().setEditing(false)
    render(
      <NewEntityScreen
        kind="mech"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
      />
    )
    // Unfiltered: a radio a chassis, at every Tech Level.
    expect(screen.getAllByRole('radio').length).toBe(SalvageUnionReference.Chassis.all().length)

    fireEvent.change(screen.getByLabelText(/search chassis/i), {
      target: { value: 'mule' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /mule/i }))
    // No name typed: the mech is made, named for its chassis until the sheet renames it.
    fireEvent.click(screen.getByRole('button', { name: 'Create Mech' }))
    await waitFor(() => expect(created.length).toBe(1))

    const mech = useUnits.getState().get('mech', created[0] as string)
    expect(mech?.chassisRef).toBe('mule')
    expect(mech?.name).toBe('Mule')
    expect(useSheetModeStore.getState().editing).toBe(true)
  })

  test('a draft left mid-build is offered: Resume your draft, or Start over (which clears it)', () => {
    sessionStorage.setItem(wizardDraftKey('mech'), JSON.stringify({ name: 'Half built' }))
    const modes: unknown[] = []
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={null}
        onModeChange={(mode) => modes.push(mode)}
        onCreated={noop}
      />
    )
    expect(screen.queryByRole('button', { name: 'Start guided' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Resume your draft' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(sessionStorage.getItem(wizardDraftKey('mech'))).toBeNull()
    expect(modes).toEqual(['guided'])
  })

  test('a book pattern above Tech 1 builds from the chooser, as printed, after it asks', async () => {
    const created: string[] = []
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
        book={{ chassis: 'magpie', pattern: 'stefanus' }}
      />
    )
    // Behind the open confirm, so read through it.
    const books = screen.getByLabelText('Book Patterns')
    expect(within(books).getByText('Not a starting build')).toBeTruthy()
    // The pattern page's press was the choice: its one confirm is already up (r2 D4),
    // worded for the book and warning, since Stefanus is past the starting rules.
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/past the starting rules/)).toBeTruthy()
    expect(within(dialog).getByText(/as the book prints it/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Build' }))
    await waitFor(() => expect(created.length).toBe(1))
    const mech = useUnits.getState().get('mech', created[0] as string)
    expect(mech?.chassisRef).toBe('magpie')
    expect(mech?.name).toBe('Stefanus')
    expect(mech?.systems.length).toBeGreaterThan(0)
  })

  test('crawler dialog offers Tech Levels 1–6, defaulting to 1', () => {
    render(
      <NewEntityScreen
        kind="crawler"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    const select = screen.getByLabelText<HTMLSelectElement>(/tech level/i)
    expect(select.options.length).toBe(6)
    expect(select.value).toBe('1')
  })
})
