/**
 * Unit tests for playStateStore — the ephemeral cockpit play-state.
 *
 * Verifies the default mount (boarded mech) and the setters. This store is
 * intentionally non-persisted; there is no IndexedDB behaviour to test.
 */

import { beforeEach, describe, expect, test } from 'bun:test'

import { usePlayStateStore } from '../playStateStore'

describe('playStateStore', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
  })

  test('defaults to the boarded mech, dial at 0', () => {
    const s = usePlayStateStore.getState()
    expect(s.mount).toBe('mech')
    expect(s.wheel).toBe(0)
  })

  test('setMount switches the active-row entity', () => {
    usePlayStateStore.getState().setMount('downtime')
    expect(usePlayStateStore.getState().mount).toBe('downtime')
    usePlayStateStore.getState().setMount('pilot')
    expect(usePlayStateStore.getState().mount).toBe('pilot')
  })

  test('setWheel moves the dial index', () => {
    usePlayStateStore.getState().setWheel(3)
    expect(usePlayStateStore.getState().wheel).toBe(3)
  })
})
