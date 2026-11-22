/**
 * NewEntityScreen + CreateModeChooser + BlankCreateDialog: mode
 * routing renders chooser vs wizard vs blank dialog, the
 * chooser doors fire their callbacks, and the Blank dialog persists a
 * schema-valid entity through createBlank.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument().
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
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
import type { CreateMode } from '../../../lib/wizard/createMode'
import { parseCreateMode } from '../../../lib/wizard/createMode'
import { draftStorage, wizardDraftKey } from '../../../lib/wizard/wizardDraft'
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
const { WizStartLines } = await import('../WizStarts')
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
  const signedOut = (mode: CreateMode, kind: 'mech' | 'npc' = 'mech') =>
    rtlRender(
      <NewEntityScreen
        kind={kind}
        mode={mode}
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )

  test('the guided wizard runs without an account, opening on its first step (SB-06, r6 F2)', async () => {
    signedOut(undefined)
    expect(await screen.findByTestId('stub-wizard')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Sign in to build a mech' })).toBeNull()
    cleanup()
    // The patterns say before any press that they need an account (r5 D5), and
    // no longer promise that Blank works signed out (PT6-15).
    signedOut('pattern')
    expect(await screen.findByText(/building from a pattern .* needs a sign-in/i)).toBeTruthy()
    expect(screen.queryByText(/Blank work/)).toBeNull()
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
    // The NPC's wall talks about NPCs, not the Pilots, Mechs and Crawlers line (r6 F9).
    expect(screen.getByText(/Design NPCs and the encounters/)).toBeTruthy()
    expect(screen.queryByText(/Pilots, Mechs and Union Crawlers/)).toBeNull()
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
  test('mode absent opens the wizard on its first step: no chooser, no dialog (r6 F2)', () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode={undefined}
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.getByTestId('stub-wizard')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /start guided/i })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
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

  test("mode 'blank' opens the blank dialog over the wizard", async () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    // The wizard stays mounted underneath (base-ui inerts it while the modal is open).
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('stub-wizard')).toBeTruthy()
    expect(screen.getByLabelText(/callsign/i)).toBeTruthy()
  })

  // MD2-04: the dialog opened on Close, and a typed space shut it.
  test('the Blank Crawler dialog opens with its name focused', async () => {
    // The dialog focuses on the next frame; the frame is run here, so the
    // test waits on no timer.
    const frame = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((run) => {
      run(0)
      return 0
    })
    try {
      await act(async () => {
        render(
          <NewEntityScreen
            kind="crawler"
            mode="blank"
            wizard={null}
            onModeChange={noop}
            onCreated={noop}
          />
        )
      })
      const name = await screen.findByRole('textbox', { name: /name/i })
      expect(document.activeElement === name).toBe(true)
    } finally {
      frame.mockRestore()
    }
  })

  test("the wizard's head links Start blank and a mech's From a pattern (r6 F2)", () => {
    const calls: CreateMode[] = []
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={<WizStartLines active={0} redesign={false} />}
        onModeChange={(next) => calls.push(next)}
        onCreated={noop}
        forPilot="Nia Vale"
      />
    )
    // Who it is for, as the chooser said it.
    expect(screen.getByText(/For Nia Vale/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start blank' }))
    fireEvent.click(screen.getByRole('button', { name: 'From a pattern' }))
    expect(calls).toEqual(['blank', 'pattern'])
  })

  test('signed out, each link says it needs a sign-in; a pilot has no pattern link', () => {
    rtlRender(
      <NewEntityScreen
        kind="pilot"
        mode={undefined}
        wizard={<WizStartLines active={0} redesign={false} />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.getByRole('button', { name: /^Start blank \(needs a sign-in\)$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /From a pattern/ })).toBeNull()
  })
})

describe('PatternStart — a mech’s patterns, from the wizard’s From a pattern (r6 F2)', () => {
  const chooser = async () => {
    render(
      <NewEntityScreen
        kind="mech"
        mode="pattern"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={noop}
        onCreated={noop}
        forPilot="Nia Vale"
      />
    )
    await screen.findByRole('heading', { name: 'From a pattern' })
  }

  test('the patterns stand alone, name the pilot, and lead back to the guided build', async () => {
    const calls: CreateMode[] = []
    usePatterns.setState({ mechPatterns: [], hydrated: true })
    render(
      <NewEntityScreen
        kind="mech"
        mode="pattern"
        wizard={<div data-testid="stub-wizard" />}
        onModeChange={(next) => calls.push(next)}
        onCreated={noop}
        forPilot="Nia Vale"
      />
    )
    expect(await screen.findByRole('heading', { name: 'From a pattern' })).toBeTruthy()
    expect(screen.queryByTestId('stub-wizard')).toBeNull()
    expect(screen.getByText(/For Nia Vale/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /guided/i }))
    expect(calls).toEqual(['guided'])
  })

  test('its chassis open on the starting level; every Tech Level is one press away (r5 D5)', async () => {
    usePatterns.setState({ mechPatterns: [], hydrated: true })
    await chooser()
    const chassis = () =>
      [...screen.getByRole('combobox', { name: 'Chassis' }).querySelectorAll('option')]
        .map((o) => o.textContent ?? '')
        .filter((t) => t !== '—')
    expect(chassis().length).toBeGreaterThan(0)
    expect(chassis().every((t) => t.endsWith('(T1)'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show every Tech Level' }))
    expect(chassis().some((t) => !t.endsWith('(T1)'))).toBe(true)
  })

  test('a picked book pattern lists its Systems and Modules and its Scrap by Tech Level (r5 D6)', async () => {
    usePatterns.setState({ mechPatterns: [], hydrated: true })
    await chooser()
    fireEvent.change(screen.getByRole('combobox', { name: 'Chassis' }), {
      target: { value: 'mule' },
    })
    const pattern = screen.getByRole('combobox', { name: 'Pattern' })
    const first = [...pattern.querySelectorAll('option')].find((o) => o.value !== '')
    fireEvent.change(pattern, { target: { value: first?.value } })
    expect(screen.getByText(/^Systems: \S/)).toBeTruthy()
    expect(screen.getByText(/Scrap TL1 \d+/)).toBeTruthy()
  })

  test('a pilot or a crawler has no patterns: its pattern mode is the wizard', () => {
    const { unmount } = render(
      <NewEntityScreen
        kind="pilot"
        mode="pattern"
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
  test('requires a name (a blank callsign is it), then persists a schema-valid pilot', async () => {
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
    await screen.findByRole('dialog')

    // The disabled Create says what it waits for (MD4-22): the name alone (r6 F5).
    const submit = screen.getByRole('button', { name: 'Add a name to create' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Juno Vale' } })
    expect(submit.textContent).toBe('Create Pilot')
    expect(screen.getByPlaceholderText('Juno Vale')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/callsign/i), { target: { value: 'Nomad' } })
    expect(submit.textContent).toBe('Create Pilot')
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => expect(created.length).toBe(1))

    const pilot = useUnits.getState().get('pilot', created[0] as string)
    expect(() => PilotSchema.parse(pilot)).not.toThrow()
    expect(pilot?.name).toBe('Juno Vale')
    expect(pilot?.callsign).toBe('Nomad')
    expect(pilot?.classRef).toBe('')
  })

  // MD3-04: Enter in a blank dialog's field is its Create.
  test('Enter in the name creates a blank crawler, and a pilot whose blank callsign is its name', async () => {
    const created: string[] = []
    const first = render(
      <NewEntityScreen
        kind="crawler"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
      />
    )
    await screen.findByRole('dialog')
    const crawlerName = screen.getByLabelText(/^name/i)
    fireEvent.keyDown(crawlerName, { key: 'Enter' })
    fireEvent.change(crawlerName, { target: { value: 'Old Faithful' } })
    fireEvent.keyDown(crawlerName, { key: 'Enter' })
    await waitFor(() => expect(created.length).toBe(1))
    expect(useUnits.getState().get('crawler', created[0] as string)?.name).toBe('Old Faithful')
    first.unmount()

    render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
      />
    )
    await screen.findByRole('dialog')
    const pilotName = screen.getByLabelText(/^name/i)
    // A blank callsign is the name (r6 F5): Enter in the name creates the pilot.
    fireEvent.change(pilotName, { target: { value: 'Juno Vale' } })
    fireEvent.keyDown(pilotName, { key: 'Enter' })
    await waitFor(() => expect(created.length).toBe(2))
    expect(useUnits.getState().get('pilot', created[1] as string)?.callsign).toBe('Juno Vale')
  })

  test('class pick is UNFILTERED — every class incl. specialisations is offered', async () => {
    render(
      <NewEntityScreen
        kind="pilot"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    await screen.findByRole('dialog')
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
    await screen.findByRole('dialog')
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

  test('a chassis page’s Build With This opens Blank with its chassis picked (r5 D8)', async () => {
    const created: string[] = []
    render(
      <NewEntityScreen
        kind="mech"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={(id) => created.push(id)}
        book={{ chassis: 'magpie' }}
      />
    )
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Create Mech' }))
    await waitFor(() => expect(created.length).toBe(1))
    expect(useUnits.getState().get('mech', created[0] as string)?.chassisRef).toBe('magpie')
  })

  test('a kept draft is offered on the wizard: Continue your draft, or Discard (which clears it, r6 F6)', () => {
    draftStorage().setItem(wizardDraftKey('mech'), JSON.stringify({ name: 'Half built' }))
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={<WizStartLines active={0} redesign={false} />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    expect(screen.getByRole('button', { name: 'Continue your draft' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(draftStorage().getItem(wizardDraftKey('mech'))).toBeNull()
    // The wizard starts again, with no draft to offer.
    expect(screen.queryByRole('button', { name: 'Continue your draft' })).toBeNull()
  })

  test('Continue your draft keeps it and puts the offer away', () => {
    draftStorage().setItem(wizardDraftKey('pilot'), JSON.stringify({ name: 'Half built' }))
    render(
      <NewEntityScreen
        kind="pilot"
        mode={undefined}
        wizard={<WizStartLines active={0} redesign={false} />}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue your draft' }))
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
    expect(draftStorage().getItem(wizardDraftKey('pilot'))).not.toBeNull()
  })

  test('a book pattern above Tech 1 builds from its patterns, as printed, in one press (r4 E23)', async () => {
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
    const books = await screen.findByLabelText('Book Patterns')
    expect(within(books).getByText('Not a starting build')).toBeTruthy()
    // A link builds nothing and asks nothing: the pick is made and the press is the player's.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(created).toEqual([])
    fireEvent.click(within(books).getByRole('button', { name: /^Build With This/ }))
    await waitFor(() => expect(created.length).toBe(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const mech = useUnits.getState().get('mech', created[0] as string)
    expect(mech?.chassisRef).toBe('magpie')
    expect(mech?.name).toBe('Stefanus')
    expect(mech?.systems.length).toBeGreaterThan(0)
  })

  test('crawler dialog offers Tech Levels 1–6, defaulting to 1', async () => {
    render(
      <NewEntityScreen
        kind="crawler"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    await screen.findByRole('dialog')
    const select = screen.getByLabelText<HTMLSelectElement>(/tech level/i)
    expect(select.options.length).toBe(6)
    expect(select.value).toBe('1')
  })
})
