/**
 * ChangeLogDrawer tests (ADR-022) — the per-entity Change Log shown behind the
 * sheet's overflow menu. The entries are the room's (`changeLog.forEntity`, an
 * act on the account room here, `fakeRooms.ts`); connected means a real
 * `SyncProvider` signed in on the stand-in rooms. Plus the menu → drawer
 * wiring on the Sheet.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import {
  acts,
  answerActs,
  batches,
  closeRooms,
  openRooms,
} from '../../../replica/__tests__/fakeRooms'

const serverMocks = await installServerMocks()

const { ChangeLogDrawer } = await import('../ChangeLogDrawer')
const { Sheet } = await import('../Sheet')
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')
const { hold } = await import('../../../replica/replica')
const { LIVE_SHEET_MANUAL } = await import('../../../replica/provenance')

afterAll(() => {
  serverMocks.restore()
})

// Building needs an account (ADR-034 as amended), so the Sheet's pilot is made signed in.
withSignedInBackend()

const connected = (ui: ReactNode) => render(<SyncProvider>{ui}</SyncProvider>)

const row = (over: Record<string, unknown>) => ({
  _id: 'r1',
  ts: 1_700_000_000_000,
  kind: 'manual',
  field: 'callsign',
  before: 'Ghost',
  after: 'Wraith',
  source: 'live-sheet',
  state: 'applied',
  ...over,
})

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

beforeEach(() => {
  resetStores()
})

afterEach(closeRooms)

describe('ChangeLogDrawer', () => {
  test("renders the server's entries with field, before→after, kind and a pending proposal", async () => {
    await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1' }))
    openRooms(null)
    const entries = [
      row({
        _id: 'r3',
        kind: 'transaction',
        field: 'currentHP',
        before: null,
        after: 3,
        state: 'proposed',
        source: 'mediator-proposal',
      }),
      row({ _id: 'r2', kind: 'override', field: 'maxHpOverride', before: 14, after: null }),
      row({ _id: 'r1' }),
    ]
    answerActs(({ name }) => (name === 'changeLog.forEntity' ? entries : undefined))

    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/Callsign:/)).toBeTruthy())
    expect(screen.getByText('Wraith')).toBeTruthy()
    expect(screen.getByText('Override')).toBeTruthy()
    // A rule's write wears no store word (r3 B4).
    expect(screen.queryByText('Transaction')).toBeNull()
    // A hand edit is the plain case: no label, and never the field's code name (r2 C2).
    expect(screen.queryByText('Manual')).toBeNull()
    expect(screen.queryByText('callsign')).toBeNull()
    // A proposal still awaiting its answer says so, rather than reading as applied.
    expect(screen.getByText('Proposed')).toBeTruthy()
    expect(acts).toEqual([{ gameId: null, name: 'changeLog.forEntity', args: { entityId: 'p1' } }])
  })

  test("a chassis swap is one change in the sheet's words, and each button reverses its own change", async () => {
    await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1' }))
    openRooms(null)
    const systems = [
      'chainsaw-arm',
      'escape-hatch',
      'locomotion-system',
      'rigging-arm',
      'red-laser',
    ]
    const entries = [
      row({ _id: 'op2:chassisRef', field: 'chassisRef', before: 'scrapper', after: 'mazona' }),
      row({ _id: 'op2:systems', field: 'systems', before: systems, after: systems.slice(0, 3) }),
      row({ _id: 'op1:name', ts: 1_600_000_000_000, field: 'name', before: 'A', after: 'B' }),
      row({ _id: 'op0:currentHP', ts: 1_500_000_000_000, state: 'proposed', field: 'currentHP' }),
    ]
    answerActs(({ name }) => (name === 'changeLog.forEntity' ? entries : undefined))
    const restored: string[][] = []

    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Leaky"
        open
        onOpenChange={() => {}}
        onRestore={(change) => restored.push(change.fields.map((f) => f.field))}
      />
    )

    await waitFor(() => expect(screen.getByText('Removed Rigging Arm, Red Laser')).toBeTruthy())
    expect(screen.getByText('Scrapper')).toBeTruthy()
    expect(screen.getByText('Mazona')).toBeTruthy()
    // One button a change, in the words of what it does (r3 B1), and none
    // for a proposal still unanswered.
    expect(screen.getAllByRole('button', { name: /^(Undo this change|Set back)/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^Set back to A: Name/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Undo this change: Chassis/ }))
    expect(restored).toEqual([['name'], ['chassisRef', 'systems']])
  })

  test('a change taken back says so and has no button; its undo has none either (r4 E2)', async () => {
    await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1' }))
    openRooms(null)
    const entries = [
      row({
        _id: 'op2:equipment',
        field: 'equipment',
        before: [],
        after: ['rope'],
        source: 'live-sheet-undo:op1',
      }),
      row({ _id: 'op1:equipment', field: 'equipment', before: ['rope'], after: [] }),
      row({ _id: 'op0:name', field: 'name', before: 'A', after: 'B' }),
    ]
    answerActs(({ name }) => (name === 'changeLog.forEntity' ? entries : undefined))

    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Leaky"
        open
        onOpenChange={() => {}}
        onRestore={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/^Removed /)).toBeTruthy())
    expect(screen.getByText('Put back')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Put back/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove:/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Set back to A/ })).toHaveLength(1)
    // To the second: ten quick edits read apart.
    expect(document.querySelector('time')?.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })

  test('a change that arrives while the dialog is open goes under Just now (r4 E2)', async () => {
    await useUnits.getState().adopt('pilot', pilotFixture({ id: 'p1' }))
    openRooms(null)
    let entries = [row({ _id: 'op0:name', field: 'name', before: 'A', after: 'B' })]
    answerActs(({ name }) => (name === 'changeLog.forEntity' ? entries : undefined))

    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Leaky"
        open
        onOpenChange={() => {}}
      />
    )
    await waitFor(() => expect(screen.getByText(/Name:/)).toBeTruthy())
    expect(screen.queryByText('Just now')).toBeNull()

    entries = [row({ _id: 'op1:callsign' }), ...entries]
    // The unit's head moves: the log is asked again.
    act(() => {
      hold('pilot', pilotFixture({ id: 'p1', callsign: 'Wraith' }), { headSeq: 9 })
    })
    await waitFor(() => expect(screen.getByText('Just now')).toBeTruthy())
    const justNow = screen.getByRole('region', { name: 'Just now' })
    expect(justNow.textContent).toContain('Callsign')
    expect(justNow.textContent).not.toContain('Name:')
  })

  test('shows an empty state when the entity has no logged changes', async () => {
    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText(/No changes recorded yet/i)).toBeTruthy())
  })

  test('without a connection it says where the log is kept, and asks the server nothing', () => {
    render(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    expect(screen.getByText(/kept with your account/i)).toBeTruthy()
    expect(acts).toHaveLength(0)
  })

  test('renders nothing while closed', () => {
    render(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="none"
        entityName="Yara Voss"
        open={false}
        onOpenChange={() => {}}
      />
    )
    expect(screen.queryByText('Change Log')).toBeNull()
  })
})

describe('Sheet — Change Log menu wiring', () => {
  test('the overflow menu opens the Change Log drawer', async () => {
    const store = useUnits.getState()
    const pilot = await store.create('pilot', basePilotInput)

    render(<Sheet kind="pilot" id={pilot.id} />)

    // Open the "⋯" overflow menu, then click the Change Log item.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Change Log' }))
    })

    // The drawer (ModalShell dialog) mounts with the "Change Log" title.
    await waitFor(() => expect(screen.getByText(/kept with your account/i)).toBeTruthy())
  })

  test('Ctrl+Z steps back one change at a time, each write naming the change it took back (r4 E3)', async () => {
    const pilot = await useUnits.getState().create('pilot', {
      ...basePilotInput,
      callsign: 'Spook',
      motto: 'Old words.',
    })
    openRooms(null)
    // Two changes this tab made (r5 C2: Ctrl+Z reaches only those), and one
    // from another tab, newest in the log, that it passes by.
    const opIds = () => batches.flatMap((batch) => batch.ops.map((op) => (op as { id: string }).id))
    await useUnits
      .getState()
      .update('pilot', pilot.id, { motto: 'Everything burns.' }, LIVE_SHEET_MANUAL)
    const op1 = opIds().at(-1)
    await useUnits.getState().update('pilot', pilot.id, { callsign: 'Ghost' }, LIVE_SHEET_MANUAL)
    const op2 = opIds().at(-1)
    const entries = [
      row({ _id: 'elsewhere:name', field: 'name', before: 'Yara', after: 'Yara Voss' }),
      row({ _id: `${op2}:callsign`, field: 'callsign', before: 'Spook', after: 'Ghost' }),
      row({
        _id: `${op1}:motto`,
        field: 'motto',
        before: 'Old words.',
        after: 'Everything burns.',
      }),
    ]
    answerActs(({ name }) => (name === 'changeLog.forEntity' ? entries : undefined))
    connected(<Sheet kind="pilot" id={pilot.id} />)
    const sources = () =>
      batches.flatMap((batch) => batch.ops.map((op) => (op as { source?: string }).source))

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    })
    await waitFor(() => expect(sources()).toContain(`live-sheet-undo:${op2}`))
    expect(useUnits.getState().get('pilot', pilot.id)?.callsign).toBe('Spook')
    expect(sources()).not.toContain('live-sheet-undo:elsewhere')

    // The log has not caught up: the next press still steps one further back.
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    })
    await waitFor(() => expect(sources()).toContain(`live-sheet-undo:${op1}`))
    expect(useUnits.getState().get('pilot', pilot.id)?.motto).toBe('Old words.')
    expect(sources().filter((source) => source === `live-sheet-undo:${op2}`)).toHaveLength(1)

    // Ctrl+Shift+Z puts back the newest undone, and Ctrl+Y the one before (r5 C2).
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true })
    })
    await waitFor(() => expect(sources()).toContain(`live-sheet-redo:${op1}`))
    expect(useUnits.getState().get('pilot', pilot.id)?.motto).toBe('Everything burns.')
    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true })
    })
    await waitFor(() => expect(sources()).toContain(`live-sheet-redo:${op2}`))
    expect(useUnits.getState().get('pilot', pilot.id)?.callsign).toBe('Ghost')

    // In a text field Ctrl+Z is the field's own.
    const field = document.createElement('input')
    document.body.append(field)
    const before = batches.length
    await act(async () => {
      fireEvent.keyDown(field, { key: 'z', ctrlKey: true })
    })
    field.remove()
    expect(batches.length).toBe(before)
  })
})
