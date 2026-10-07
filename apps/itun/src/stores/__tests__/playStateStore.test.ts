/**
 * Unit tests for playStateStore — the Dashboard's remaining per-device state.
 *
 * Mount, range and effects live on the seat now (`useSeat`); what is left is
 * Downtime on this device and the damage hand-off. This store
 * is intentionally non-persisted; there is no IndexedDB behaviour to test.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { usePlayStateStore } from '../playStateStore'

describe('playStateStore', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ downtime: false, dtStep: 0, dtDone: {} })
  })

  test('defaults to out of Downtime', () => {
    expect(usePlayStateStore.getState().downtime).toBe(false)
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

  test('armDamagePrompt / consumeDamagePrompt is a one-shot hand-off (deck Apply → the Major)', () => {
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(false)
    usePlayStateStore.getState().armDamagePrompt()
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(true)
    // The Major consumes it once it opens its Take-Damage overlay.
    usePlayStateStore.getState().consumeDamagePrompt()
    expect(usePlayStateStore.getState().damagePromptArmed).toBe(false)
  })
})
