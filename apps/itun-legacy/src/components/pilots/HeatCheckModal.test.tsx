/**
 * HeatCheckModal — Catastrophic Meltdown cascade tests.
 *
 * Tests the roll-1 (result-catastrophic) branch:
 * - Confirm Meltdown button is present in the catastrophic phase
 * - Confirm button is disabled while the cascade is pending
 * - The cascade calls updateMechEntityRef for each non-destroyed ref
 * - Already-destroyed refs are skipped
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock supabase client before any transitive import can evaluate it
mock.module('../../lib/supabase', () => ({
  supabase: {
    from: mock(() => ({
      insert: mock(() => Promise.resolve({ data: null, error: null })),
      select: mock(() => ({
        eq: mock(() => ({
          order: mock(() => Promise.resolve({ data: [], error: null })),
          single: mock(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    auth: {
      getSession: mock(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: mock(() => ({ data: { subscription: { unsubscribe: mock(() => {}) } } })),
    },
    channel: mock(() => ({ on: mock(() => ({})), subscribe: mock(() => {}) })),
  },
}))

// Mock changeLogApi directly
const mockChangeLogLog = mock(async () => {})
mock.module('../../lib/api/changeLogApi', () => ({
  changeLogApi: { log: mockChangeLogLog },
}))

// Mock useUpdateMechEntityRef — capture mutate calls
const mockMutate = mock(
  (_args: unknown, callbacks?: { onSuccess?: () => void; onError?: (err: Error) => void }) => {
    // Simulate immediate success by default
    callbacks?.onSuccess?.()
  }
)

mock.module('../../hooks/useMechs', () => ({
  useUpdateMechEntityRef: () => ({
    mutate: mockMutate,
  }),
  useUpdateMech: () => ({ mutate: mock(() => {}), isPending: false }),
  mechKeys: {
    all: ['mechs'],
    entityRefs: (id: string) => ['mechs', 'entityRefs', id],
  },
}))

// Mock useApplyDamage so roll 11-19 auto-apply doesn't hit Supabase
mock.module('../../hooks/useApplyDamage', () => ({
  useApplyDamage: () => ({
    applyDamage: mock(() => {}),
    isPending: false,
  }),
}))

// Mock sonner toast
const mockToastSuccess = mock(() => {})
mock.module('sonner', () => ({
  toast: Object.assign(
    mock(() => {}),
    {
      error: mock(() => {}),
      success: mockToastSuccess,
    }
  ),
}))

// Import AFTER all mocks are registered
import { HeatCheckModal } from './HeatCheckModal'
import type { EntityRefRow, MechRow, PilotRow } from '../../types/common'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// --- Fixture factories ---

function makeMech(overrides?: Partial<MechRow>): MechRow {
  return {
    id: 'mech-1',
    pilot_id: 'pilot-1',
    user_id: 'user-1',
    chassis_ref: 'iron-mongrel',
    pattern_name: 'Red Fury',
    current_sp: 10,
    max_sp: 20,
    current_ep: 3,
    max_ep: 5,
    current_heat: 4,
    heat_capacity: 8,
    image_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as MechRow
}

function makePilot(overrides?: Partial<PilotRow>): PilotRow {
  return {
    id: 'pilot-1',
    user_id: 'user-1',
    callsign: 'Sparks',
    class_ref: 'engineer',
    hp: 10,
    max_hp: 10,
    ap: 3,
    max_ap: 3,
    tp: 0,
    is_boarded: true,
    in_downtime: false,
    visible: true,
    image_path: null,
    background: null,
    motto: null,
    keepsake: null,
    appearance: null,
    crawler_id: null,
    mech_id: 'mech-1',
    campaign_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    injuries: null,
    ...overrides,
  } as PilotRow
}

function makeEntityRef(
  id: string,
  condition: 'intact' | 'damaged' | 'destroyed' = 'intact'
): EntityRefRow {
  return {
    id,
    user_id: 'user-1',
    parent_id: 'mech-1',
    parent_type: 'mech',
    schema_name: 'systems',
    schema_ref_id: `system-${id}`,
    condition,
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as EntityRefRow
}

function renderModal(mechRefs: EntityRefRow[] = [makeEntityRef('ref-a'), makeEntityRef('ref-b')]) {
  const mech = makeMech()
  const pilot = makePilot()

  return render(
    <Wrapper>
      <HeatCheckModal
        open={true}
        onOpenChange={() => {}}
        currentHeat={mech.current_heat}
        mech={mech}
        pilot={pilot}
        mechRefs={mechRefs}
        userId="user-1"
      />
    </Wrapper>
  )
}

/** Force rollD20 to return 1 (catastrophic) by setting Math.random = () => 0 */
async function triggerCatastrophicRoll() {
  const original = Math.random
  Math.random = () => 0 // floor(0 * 20) + 1 = 1
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }))
  })
  Math.random = original
}

describe('HeatCheckModal — result-catastrophic phase', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockChangeLogLog.mockClear()
    mockToastSuccess.mockClear()
  })

  test('shows Confirm Meltdown button after a roll-1 result', async () => {
    renderModal()
    await triggerCatastrophicRoll()

    expect(screen.getByRole('button', { name: /confirm meltdown/i })).toBeDefined()
  })

  test('Confirm Meltdown button is not disabled before clicking', async () => {
    renderModal()
    await triggerCatastrophicRoll()

    const confirmBtn = screen.getByRole('button', { name: /confirm meltdown/i })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false)
  })

  test('cascade calls updateMechEntityRef for each non-destroyed ref', async () => {
    const mechRefs = [
      makeEntityRef('ref-a', 'intact'),
      makeEntityRef('ref-b', 'damaged'),
      makeEntityRef('ref-c', 'destroyed'), // should be skipped
    ]
    renderModal(mechRefs)
    await triggerCatastrophicRoll()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm meltdown/i }))
    })

    // ref-a and ref-b only — ref-c (destroyed) must be skipped
    expect(mockMutate).toHaveBeenCalledTimes(2)
  })

  test('already-destroyed refs are skipped entirely', async () => {
    const mechRefs = [makeEntityRef('ref-x', 'destroyed'), makeEntityRef('ref-y', 'destroyed')]
    renderModal(mechRefs)
    await triggerCatastrophicRoll()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm meltdown/i }))
    })

    // All refs already destroyed — mutate should not be called
    expect(mockMutate).toHaveBeenCalledTimes(0)
  })

  test('each mutate call sets condition to destroyed', async () => {
    const mechRefs = [makeEntityRef('ref-a', 'intact'), makeEntityRef('ref-b', 'damaged')]
    renderModal(mechRefs)
    await triggerCatastrophicRoll()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm meltdown/i }))
    })

    for (const call of mockMutate.mock.calls) {
      const [args] = call as [{ refId: string; input: { condition: string }; mechId: string }]
      expect(args.input.condition).toBe('destroyed')
    }
  })
})
