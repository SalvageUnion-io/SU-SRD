import { describe, expect, test } from 'bun:test'

/** `HeldResolve`: a resolve's steps held offline, then sent in order (r6 A14). */

import { WritesBlockedOffline } from '../../replica/sync'
import type { HeldStep } from '../heldResolve.model'
import { HeldResolve } from '../heldResolve.model'

const opened = { ref: 'k', name: 'Crush', activated: false, applied: false }
const rolled = { ...opened, activated: true, roll: { roll: 3, band: 'failure' as const } }

describe('HeldResolve', () => {
  test('each held step follows the one before it, and the view is the last', () => {
    const held = new HeldResolve()
    expect(held.view(opened)).toBe(opened)
    held.hold(rolled, opened)
    held.hold(null, opened)
    expect(held.pending).toBe(true)
    expect(held.view(opened)).toBeNull()
  })

  test('sent oldest first; a dropped connection keeps the rest for the next return', async () => {
    const held = new HeldResolve()
    held.hold(rolled, opened)
    held.hold(null, opened)
    const sent: HeldStep[] = []
    let drop = true
    const act = async (step: HeldStep) => {
      if (sent.length === 1 && drop) throw new WritesBlockedOffline()
      sent.push(step)
    }
    await held.send(act, () => undefined)
    expect(sent).toEqual([{ resolving: rolled, follows: opened }])
    expect(held.pending).toBe(true)
    drop = false
    await held.send(act, () => undefined)
    expect(sent[1]).toEqual({ resolving: null, follows: rolled })
    expect(held.pending).toBe(false)
  })

  test('a refused step is handed back, and the rest dropped with it', async () => {
    const held = new HeldResolve()
    held.hold(rolled, opened)
    held.hold(null, opened)
    const refused: HeldStep[] = []
    await held.send(
      () => Promise.reject(new Error('The table moved on while this was offline')),
      (step) => refused.push(step)
    )
    expect(refused).toEqual([{ resolving: rolled, follows: opened }])
    expect(held.pending).toBe(false)
    expect(held.view(null)).toBeNull()
  })
})
