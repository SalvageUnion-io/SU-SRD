/**
 * `useTableRead` answers a read from its room's record as the read of that
 * name does (a feed's newest `limit`, one pilot's Downtime steps, a solo
 * seat off the account room), and `useTableAct` sends an act to the room
 * it names, refused offline when that room is not open.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { WritesBlockedOffline } from '../sync'
import { useTableAct, useTableRead } from '../useTable'
import { acts, answerActs, closeRooms, openRooms, serve } from './fakeRooms'

afterEach(() => {
  cleanup()
  closeRooms()
})

const seat = (pilotId: string, downtime: object | null = null) => ({
  pilotId,
  mount: { kind: 'foot' },
  range: 'Close',
  activeEffects: [],
  resolving: null,
  ejected: false,
  updatedAt: 1,
  downtime,
})

describe('useTableRead', () => {
  test('undefined before the room’s snapshot, and while skipped', () => {
    const { result } = renderHook(() => useTableRead('seats.forGame', { gameId: 'g1' }))
    expect(result.current).toBeUndefined()
    act(() => serve('g1', { seats: [seat('p1')] }))
    expect(result.current).toHaveLength(1)
    const skipped = renderHook(() => useTableRead('seats.forGame', 'skip'))
    expect(skipped.result.current).toBeUndefined()
  })

  test('a list as the room keeps it, and the same answer until it changes', () => {
    serve('g1', { seats: [seat('p1'), seat('p2')] })
    const { result, rerender } = renderHook(() => useTableRead('seats.forGame', { gameId: 'g1' }))
    const first = result.current
    expect(first?.map((s) => s.pilotId)).toEqual(['p1', 'p2'])
    rerender()
    expect(result.current).toBe(first as never)
  })

  test('a feed answers its newest `limit`', () => {
    const rolls = [3, 2, 1].map((ts) => ({ _id: `r${ts}`, ts, source: 's', description: 'd' }))
    serve('g1', { rolls })
    const { result } = renderHook(() => useTableRead('changeLog.rolls', { gameId: 'g1', limit: 2 }))
    expect(result.current?.map((r) => r._id)).toEqual(['r3', 'r2'])
  })

  test('one row, or null once served without it', () => {
    serve('g1', { scene: { conditions: ['fog'], hours: 2 }, ledger: null })
    const scene = renderHook(() => useTableRead('scenes.current', { gameId: 'g1' }))
    expect(scene.result.current).toEqual({ conditions: ['fog'], hours: 2 } as never)
    const ledger = renderHook(() => useTableRead('ledger.get', { gameId: 'g1' }))
    expect(ledger.result.current).toBeNull()
  })

  test('a Game’s Downtime answers the steps this pilot took', () => {
    serve('g1', {
      downtime: {
        running: true,
        runId: 'run1',
        stepIndex: 1,
        startedAt: 5,
        completedBy: [],
        upkeepSpent: false,
        doneSteps: { p1: [0], p2: [0, 1] },
      },
    })
    const { result } = renderHook(() =>
      useTableRead('downtime.state', { gameId: 'g1', pilotId: 'p2' })
    )
    expect(result.current).toMatchObject({ runId: 'run1', doneSteps: [0, 1] })
  })

  test('solo, the seat and its Downtime come off the account room', () => {
    const running = { runId: '9', stepIndex: 2, startedAt: 9, upkeepSpent: true, doneSteps: [1] }
    serve(null, { seats: [seat('p1', running), seat('p2')] })
    const solo = renderHook(() => useTableRead('seats.solo', { gameId: null, pilotId: 'p1' }))
    expect(solo.result.current?.pilotId).toBe('p1')
    const busy = renderHook(() => useTableRead('downtime.state', { gameId: null, pilotId: 'p1' }))
    expect(busy.result.current).toMatchObject({ running: true, stepIndex: 2, completedBy: [] })
    const idle = renderHook(() => useTableRead('downtime.state', { gameId: null, pilotId: 'p2' }))
    expect(idle.result.current).toMatchObject({ running: false, stepIndex: null })
    const gone = renderHook(() => useTableRead('downtime.state', { gameId: null, pilotId: 'px' }))
    expect(gone.result.current).toBeNull()
  })

  test('the running encounter, and whether the reader mediates', () => {
    serve('g1', { mediator: { id: 'mediator', running: null } })
    const mediates = renderHook(() => useTableRead('mediator.amMediator', { gameId: 'g1' }))
    expect(mediates.result.current).toBe(true)
    const running = renderHook(() => useTableRead('mediator.running', { gameId: 'g1' }))
    expect(running.result.current).toBeNull()
  })
})

describe('useTableAct', () => {
  test('sends the act by name to the room it names, and answers its value', async () => {
    openRooms('g1')
    answerActs(() => 'op-1')
    const { result } = renderHook(() => useTableAct('ops.propose', 'g1'))
    let id: unknown
    await act(async () => {
      id = await result.current({ entityId: 'p1', field: 'currentHP', after: 3 })
    })
    expect(id).toBe('op-1')
    expect(acts).toEqual([
      { gameId: 'g1', name: 'ops.propose', args: { entityId: 'p1', field: 'currentHP', after: 3 } },
    ])
  })

  test('refused offline when the room is not open', async () => {
    const { result } = renderHook(() => useTableAct('seats.eject', 'g2'))
    await expect(result.current({ pilotId: 'p1' })).rejects.toBeInstanceOf(WritesBlockedOffline)
  })
})
