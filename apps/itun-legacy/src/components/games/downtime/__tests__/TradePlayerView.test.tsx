import { describe, it, expect, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'

mock.module('../../../lib/errors', () => ({
  getErrorMessage: (err: unknown) => String(err),
}))

mock.module('../../../components/shared/ReferenceEntityListingItem', () => ({
  ReferenceEntityListingItem: () => null,
}))

mock.module('../../shared/ReferenceEntityListingItem', () => ({
  ReferenceEntityListingItem: () => null,
}))

mock.module('sonner', () => ({
  toast: { error: mock(() => {}), success: mock(() => {}) },
}))

import { TradePlayerView } from '../TradePlayerView'
import type { DowntimeRecordRow } from '../../../../types/common'

const baseDowntime = {
  id: 'downtime-1',
  crawler_id: 'crawler-1',
  trade_result: null,
  trade_roll_key: null,
  trade_roll_value: null,
  training_receipts: null,
  restore_receipts: null,
  upkeep_paid: false,
  created_at: '2024-01-01T00:00:00Z',
} as unknown as DowntimeRecordRow

describe('TradePlayerView — pre-roll vs post-roll state', () => {
  it('shows "rolling" wait state when trade_roll_key is null (mediator has not rolled yet)', () => {
    render(<TradePlayerView activeDowntime={baseDowntime} />)
    expect(
      screen.getByText('Waiting for mediator to roll on the Trading Bay table...')
    ).toBeDefined()
  })

  it('shows "selecting" wait state when trade_roll_key is set but no trade_result yet', () => {
    const downtimePostRoll = {
      ...baseDowntime,
      trade_roll_key: '6-10',
      trade_roll_value: 7,
    } as unknown as DowntimeRecordRow
    render(<TradePlayerView activeDowntime={downtimePostRoll} />)
    expect(screen.getByText('Mediator is selecting trade items...')).toBeDefined()
  })
})
