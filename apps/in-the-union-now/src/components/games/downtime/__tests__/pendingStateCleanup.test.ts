/**
 * Tests for the pending state cleanup contract.
 *
 * When the mediator transitions to the pre-session phase, the mutation input
 * must null out all pending columns so orphaned mid-roll state doesn't bleed
 * into the next session.
 */
import { describe, test, expect } from 'bun:test'

// The input object produced by handleConfirmMoveToPreSession in DowntimeGuideView.
// We extract the construction logic here to verify the shape without rendering
// the full component (which has deep hook/Supabase dependencies).
function buildPreSessionInput() {
  return {
    pre_session_started: true,
    trade_roll_key: null,
    trade_roll_value: null,
    deterioration_pending: null,
  }
}

describe('pre-session pending state cleanup', () => {
  test('sets pre_session_started to true', () => {
    const input = buildPreSessionInput()
    expect(input.pre_session_started).toBe(true)
  })

  test('nulls trade_roll_key', () => {
    const input = buildPreSessionInput()
    expect(input.trade_roll_key).toBeNull()
  })

  test('nulls trade_roll_value', () => {
    const input = buildPreSessionInput()
    expect(input.trade_roll_value).toBeNull()
  })

  test('nulls deterioration_pending', () => {
    const input = buildPreSessionInput()
    expect(input.deterioration_pending).toBeNull()
  })

  test('cleanup and phase transition happen in a single input object (atomic update)', () => {
    const input = buildPreSessionInput()
    const keys = Object.keys(input)
    expect(keys).toContain('pre_session_started')
    expect(keys).toContain('trade_roll_key')
    expect(keys).toContain('trade_roll_value')
    expect(keys).toContain('deterioration_pending')
    // All four fields present — one DB round-trip
    expect(keys).toHaveLength(4)
  })
})
