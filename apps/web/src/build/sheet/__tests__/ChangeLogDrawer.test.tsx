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
import { acts, answerActs, closeRooms, openRooms } from '../../../replica/__tests__/fakeRooms'

const serverMocks = await installServerMocks()

const { ChangeLogDrawer } = await import('../ChangeLogDrawer')
const { Sheet } = await import('../Sheet')
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')

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
})
