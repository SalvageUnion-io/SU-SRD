import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { render, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUpdatePilotMutate = mock(() => {})

mock.module('../../../../hooks/usePilots', () => ({
  usePilot: () => ({ data: { id: 'pilot-1', tp: 5, class_ref: 'salvager' } }),
  useUpdatePilot: () => ({ mutate: mockUpdatePilotMutate, isPending: false }),
  usePilotEntityRefs: () => ({ data: [] }),
  useCreateEntityRef: () => ({ mutate: mock(() => {}), isPending: false }),
}))

mock.module('../../../../hooks/useCrawlers', () => ({
  useSaveTrainingReceipt: () => ({ mutate: mock(() => {}), isPending: false }),
}))

mock.module('../../../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ id: 'user-1' }),
}))

mock.module('../../../../lib/bayDamageUtils', () => ({
  isPilotBayDamaged: () => false,
}))

mock.module('../TrainingAbilityModal', () => ({
  TrainingAbilityModal: () => null,
}))

mock.module('sonner', () => ({
  toast: { error: mock(() => {}), success: mock(() => {}) },
}))

mock.module('../../../../lib/errors', () => ({
  getErrorMessage: (err: unknown) => String(err),
}))

import { TrainStep } from '../TrainStep'
import type { DowntimeRecordRow } from '../../../../types/common'

function makeDowntime(trainingReceipts: Record<string, unknown> | null = null): DowntimeRecordRow {
  return {
    id: 'downtime-1',
    crawler_id: 'crawler-1',
    game_id: 'game-1',
    status: 'active',
    trade_result: null,
    training_receipts: trainingReceipts,
    restore_receipts: null,
    salvage_receipts: null,
    upkeep_paid: false,
    deterioration_applied: false,
    guide_step: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as unknown as DowntimeRecordRow
}

const baseProps = {
  pilotId: 'pilot-1',
  crawlerId: 'crawler-1',
  crawlerTL: 3,
  bayNpcs: {},
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('TrainStep — TP grant idempotency (persisted receipt)', () => {
  beforeEach(() => {
    mockUpdatePilotMutate.mockClear()
  })

  it('grants TP when no receipt exists for the pilot', async () => {
    await act(async () => {
      render(<TrainStep {...baseProps} activeDowntime={makeDowntime(null)} />, { wrapper })
    })
    expect(mockUpdatePilotMutate).toHaveBeenCalledTimes(1)
  })

  it('does NOT grant TP when receipt already has tp_granted > 0', async () => {
    const receipts = {
      'pilot-1': { tp_granted: 1, abilities_learned: [], tp_remaining: 5 },
    }
    await act(async () => {
      render(<TrainStep {...baseProps} activeDowntime={makeDowntime(receipts)} />, { wrapper })
    })
    expect(mockUpdatePilotMutate).not.toHaveBeenCalled()
  })

  it('does NOT grant TP on remount when receipt already has tp_granted > 0', async () => {
    const receipts = {
      'pilot-1': { tp_granted: 1, abilities_learned: [], tp_remaining: 5 },
    }
    const downtime = makeDowntime(receipts)

    // First mount
    let unmount!: () => void
    await act(async () => {
      const result = render(<TrainStep {...baseProps} activeDowntime={downtime} />, { wrapper })
      unmount = result.unmount
    })
    unmount()

    // Remount — ref-based guard resets on remount, but DB-sourced tpGranted must still block it
    await act(async () => {
      render(<TrainStep {...baseProps} activeDowntime={downtime} />, { wrapper })
    })

    expect(mockUpdatePilotMutate).not.toHaveBeenCalled()
  })
})
