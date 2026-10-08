/**
 * ChangeLogDrawer tests (ADR-022) — the per-entity Change Log shown behind the
 * sheet's overflow menu. The entries are the server's (`changeLog.forEntity`),
 * answered here by the name-keyed `useQuery` double; connected means a real
 * `ConnectionProvider` over the mocked Convex client. Plus the menu → drawer
 * wiring on the Sheet.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../__tests__/convexMock'

const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})

const { ChangeLogDrawer } = await import('../ChangeLogDrawer')
const { Sheet } = await import('../Sheet')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { _resetDbSingleton, clearCache } = await import('../../../lib/db/index')
const { withSignedInBackend } = await import('../../../stores/__tests__/signedInBackend')
const { useEntityStore } = await import('../../../stores/entityStore')

afterAll(() => {
  convexMocks.restore()
})

// Building needs an account (ADR-034 as amended), so the Sheet's pilot is made signed in.
withSignedInBackend()

const connected = (ui: ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

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

beforeEach(async () => {
  setQueryAnswers({})
  _resetDbSingleton()
  await clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
})

describe('ChangeLogDrawer', () => {
  test("renders the server's entries with field, before→after, kind and a pending proposal", async () => {
    setQueryAnswers({
      'changeLog:forEntity': [
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
      ],
    })

    connected(
      <ChangeLogDrawer
        entityType="pilot"
        entityId="p1"
        entityName="Yara Voss"
        open
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => expect(screen.getByText('callsign')).toBeTruthy())
    expect(screen.getByText('Wraith')).toBeTruthy()
    expect(screen.getByText('Override')).toBeTruthy()
    expect(screen.getByText('Manual')).toBeTruthy()
    // A proposal still awaiting its answer says so, rather than reading as applied.
    expect(screen.getByText('Proposed')).toBeTruthy()
    expect(queryCalls()).toContainEqual({
      name: 'changeLog:forEntity',
      args: { entityType: 'pilot', entityId: 'p1' },
    })
  })

  test('shows an empty state when the entity has no logged changes', async () => {
    setQueryAnswers({ 'changeLog:forEntity': [] })

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
    expect(queryCalls()).toHaveLength(0)
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
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', basePilotInput)

    render(<Sheet kind="pilot" id={pilot.id} />)

    // Open the "⋯" overflow menu, then click the Change Log item.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /change log for this pilot/i }))
    })

    // The drawer (ModalShell dialog) mounts with the "Change Log" title.
    await waitFor(() => expect(screen.getByText(/kept with your account/i)).toBeTruthy())
  })
})
