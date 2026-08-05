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
    usePlayStateStore.setState({
      mount: 'pilot',
      wheel: 0,
      priorMount: null,
      dtStep: 0,
      dtDone: {},
    })
  })

  test('defaults to the on-foot pilot, dial at 0', () => {
    const s = usePlayStateStore.getState()
    expect(s.mount).toBe('pilot')
    expect(s.wheel).toBe(0)
    expect(s.priorMount).toBeNull()
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

  test('enterDowntime remembers the prior mount and resets the wizard', () => {
    usePlayStateStore.setState({ mount: 'pilot', dtStep: 4, dtDone: { 0: true } })
    usePlayStateStore.getState().enterDowntime()
    const s = usePlayStateStore.getState()
    expect(s.mount).toBe('downtime')
    expect(s.priorMount).toBe('pilot')
    expect(s.dtStep).toBe(0)
    expect(s.dtDone).toEqual({})
  })

  test('enterDowntime while already in Downtime is a no-op (keeps priorMount)', () => {
    usePlayStateStore.setState({ mount: 'downtime', priorMount: 'mech' })
    usePlayStateStore.getState().enterDowntime()
    const s = usePlayStateStore.getState()
    expect(s.mount).toBe('downtime')
    expect(s.priorMount).toBe('mech')
  })

  test('leaveDowntime restores the mount active when entered', () => {
    usePlayStateStore.getState().setMount('pilot')
    usePlayStateStore.getState().enterDowntime()
    usePlayStateStore.getState().leaveDowntime()
    const s = usePlayStateStore.getState()
    expect(s.mount).toBe('pilot')
    expect(s.priorMount).toBeNull()
  })

  test('leaveDowntime falls back to mech when no prior mount is set', () => {
    usePlayStateStore.setState({ mount: 'downtime', priorMount: null })
    usePlayStateStore.getState().leaveDowntime()
    expect(usePlayStateStore.getState().mount).toBe('mech')
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
