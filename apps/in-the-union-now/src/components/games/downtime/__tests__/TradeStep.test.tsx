import { describe, it, expect, mock } from 'bun:test'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// mock.module must be called before the component is imported
mock.module('../../../../hooks/useCrawlers', () => ({
  useSaveTradeResult: () => ({
    mutate: mock(() => {}),
    isPending: false,
  }),
}))

mock.module('../TradeSelectionModal', () => ({
  TradeSelectionModal: () => null,
}))

mock.module('../../../../lib/errors', () => ({
  getErrorMessage: (err: unknown) => String(err),
}))

mock.module('../../../shared/ReferenceEntityListingItem', () => ({
  ReferenceEntityListingItem: () => null,
}))

mock.module('sonner', () => ({
  toast: { error: mock(() => {}), success: mock(() => {}) },
}))

import { TradeStep } from '../TradeStep'
import type { DowntimeRecordRow } from '../../../../types/common'

const baseDowntime = {
  id: 'downtime-1',
  crawler_id: 'crawler-1',
  game_id: 'game-1',
  status: 'active',
  trade_result: null,
  training_receipts: null,
  restore_receipts: null,
  salvage_receipts: null,
  upkeep_paid: false,
  deterioration_applied: false,
  guide_step: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as unknown as DowntimeRecordRow

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function renderTradeStep(props: Partial<React.ComponentProps<typeof TradeStep>> = {}) {
  return render(
    <TradeStep
      crawlerId="crawler-1"
      crawlerTL={3}
      activeDowntime={baseDowntime}
      rollKey={null}
      rollValue={null}
      {...props}
    />,
    { wrapper }
  )
}

describe('TradeStep — auto-open in useEffect (not render)', () => {
  it('renders without throwing when rollKey is present and no saved result', () => {
    expect(() => {
      renderTradeStep({ rollKey: '6-10', rollValue: 7 })
    }).not.toThrow()
  })

  it('renders without throwing when rollKey is null', () => {
    expect(() => {
      renderTradeStep({ rollKey: null, rollValue: null })
    }).not.toThrow()
  })

  it('renders without throwing when category is nothing (roll 1)', () => {
    expect(() => {
      renderTradeStep({ rollKey: '1', rollValue: 1 })
    }).not.toThrow()
  })
})
