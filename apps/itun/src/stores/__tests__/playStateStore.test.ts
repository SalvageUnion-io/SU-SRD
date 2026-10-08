/**
 * Unit tests for playStateStore — the Dashboard's remaining per-device state.
 *
 * Mount, range and effects live on the seat now (`useSeat`); what is left is
 * Downtime on this device, the Dial index and the damage hand-off. This store
 * is intentionally non-persisted; there is no IndexedDB behaviour to test.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { usePlayStateStore } from '../playStateStore'

describe('playStateStore', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ downtime: false, wheel: 0, dtStep: 0, dtDone: {} })
  })

  test('defaults to out of Downtime, dial at 0', () => {
    const s = usePlayStateStore.getState()
    expect(s.downtime).toBe(false)
    expect(s.wheel).toBe(0)
  })

  test('setWheel moves the dial index', () => {
    usePlayStateStore.getState().setWheel(3)
    expect(usePlayStateStore.getState().wheel).toBe(3)
  })

  test('enterDowntime enters it and resets the wizard', () => {
    usePlayStateStore.setState({ dtStep: 4, dtDone: { 0: true } })
    usePlayStateStore.getState().enterDowntime()
    const s = usePlayStateStore.getState()
    expect(s.downtime).toBe(true)
    expect(s.dtStep).toBe(0)
    expect(s.dtDone).toEqual({})
  })

  test('enterDowntime while already in Downtime keeps the wizard where it is', () => {
    usePlayStateStore.setState({ downtime: true, dtStep: 3 })
    usePlayStateStore.getState().enterDowntime()
    expect(usePlayStateStore.getState().dtStep).toBe(3)
  })

  test('leaveDowntime leaves it', () => {
    usePlayStateStore.getState().enterDowntime()
    usePlayStateStore.getState().leaveDowntime()
    expect(usePlayStateStore.getState().downtime).toBe(false)
  })

  test('setDtStep + toggleDtDone drive the ephemeral wizard cursor', () => {
    usePlayStateStore.getState().setDtStep(2)
    expect(usePlayStateStore.getState().dtStep).toBe(2)
    usePlayStateStore.getState().toggleDtDone(2)
    expect(usePlayStateStore.getState().dtDone[2]).toBe(true)
    usePlayStateStore.getState().toggleDtDone(2)
    expect(usePlayStateStore.getState().dtDone[2]).toBe(false)
  })

  test('armDamagePrompt / consumeDamagePrompt is a one-shot hand-off (deck Apply → band)', () => {
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(false)
    usePlayStateStore.getState().armDamagePrompt()
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(true)
    // The active band consumes it once it opens its Take-Damage overlay.
    usePlayStateStore.getState().consumeDamagePrompt()
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(false)
  })
})
