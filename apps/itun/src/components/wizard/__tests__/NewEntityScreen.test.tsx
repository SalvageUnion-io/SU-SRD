/**
 * NewEntityScreen + CreateModeChooser + BlankCreateDialog (wizard-refresh
 * Phase 1): mode routing renders chooser vs wizard vs blank dialog, the
 * chooser doors fire their callbacks, and the Blank dialog persists a
 * schema-valid entity through createBlank.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), no mock.module().
 * fake-indexeddb/auto is preloaded via bunfig.toml.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { ConnectionContext } from '../../../lib/connection/connectionContext'
import { _clearAllStores, _resetDbSingleton } from '../../../lib/db/index'
import { PilotSchema } from '../../../lib/schemas/pilot'
import { parseCreateMode } from '../../../lib/wizard/createMode'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { NewEntityScreen } from '../NewEntityScreen'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

function Connected({ children }: { children: ReactNode }) {
  return <ConnectionContext.Provider value={CONNECTED}>{children}</ConnectionContext.Provider>
}

/** Every render here is signed in, unless a test renders Solo on purpose. */
const render = (ui: ReactNode) => rtlRender(ui, { wrapper: Connected })

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  resetEntityStore()
})

afterEach(async () => {
  cleanup()
  await _clearAllStores()
  resetEntityStore()
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
  test('is the sign-in panel in every mode: building needs an account', () => {
    for (const mode of [undefined, 'guided', 'blank'] as const) {
      // Outside any provider the connection is Solo.
      rtlRender(
        <NewEntityScreen
          kind="mech"
          mode={mode}
          wizard={<div data-testid="stub-wizard" />}
          onModeChange={noop}
          onCreated={noop}
        />
      )
      expect(screen.getByRole('heading', { name: 'Sign in to build a mech' })).toBeTruthy()
      expect(screen.queryByTestId('stub-wizard')).toBeNull()
      expect(screen.queryByRole('button', { name: /guided/i })).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
      cleanup()
    }
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
    expect(container.querySelector('.sheet--pilot')).toBeTruthy()
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

describe('CreateModeChooser — mech third door', () => {
  test('mech chooser surfaces Instantiate from Pattern linking to /mechs/patterns', () => {
    render(
      <NewEntityScreen
        kind="mech"
        mode={undefined}
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    const patternDoor = screen.getByRole('link', { name: /instantiate from pattern/i })
    expect(patternDoor).toBeTruthy()
    expect((patternDoor as HTMLAnchorElement).href).toContain('/mechs/patterns')
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
    expect(screen.queryByRole('link', { name: /instantiate from pattern/i })).toBeFalsy()
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
    expect(screen.queryByRole('link', { name: /instantiate from pattern/i })).toBeFalsy()
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

    const submit = screen.getByRole('button', { name: /create blank pilot/i })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Juno Vale' } })
    fireEvent.change(screen.getByLabelText(/callsign/i), { target: { value: 'Nomad' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(submit)
    await waitFor(() => expect(created.length).toBe(1))

    const pilot = useEntityStore.getState().get('pilot', created[0] as string)
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

  test('mech chassis pick is UNFILTERED — every chassis at every Tech Level', () => {
    render(
      <NewEntityScreen
        kind="mech"
        mode="blank"
        wizard={null}
        onModeChange={noop}
        onCreated={noop}
      />
    )
    const select = screen.getByLabelText<HTMLSelectElement>(/chassis \(optional\)/i)
    expect(select.options.length).toBe(SalvageUnionReference.Chassis.all().length + 1)
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
