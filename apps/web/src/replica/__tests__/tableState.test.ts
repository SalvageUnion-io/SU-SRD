/**
 * What a table plays under, as a Game room serves it (`tableState.ts`): each
 * room's Scene, area, ledger, boundaries and Stop Sign, read as the Convex
 * query of the same name answered.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { gameScope, getView, resetReplica } from '../replica'
import { foldRoomMessage } from '../roomSocket'
import { forgetTableState, readTableState } from '../tableState'

const G1 = gameScope('g1')
const G2 = gameScope('g2')

const snapshot = (records: object) => ({ type: 'snapshot', units: [], records, links: [] })
const scene = { appId: 'scene', body: { conditions: ['freezing'], hours: 2 }, updatedAt: 1 }
const line = (id: string, text: string) => ({
  appId: id,
  body: { kind: 'outOfBounds', text, mine: true, mayRemove: true },
  updatedAt: 1,
})

beforeEach(resetReplica)

describe('a Game room’s table state', () => {
  test('nothing is known before the room’s snapshot; after it, a missing record is none', () => {
    expect(readTableState(G1, 'scene')).toBeUndefined()
    foldRoomMessage(G1, snapshot({}))
    expect(readTableState(G1, 'scene')).toBeNull()
    expect(readTableState(G1, 'boundaries')).toEqual([])
  })

  test('a snapshot serves each record as its query answered, apart from the replica’s rows', () => {
    foldRoomMessage(G1, snapshot({ scene: [scene], boundaries: [line('b1', 'Spiders')] }))
    expect(readTableState(G1, 'scene')).toEqual({ conditions: ['freezing'], hours: 2 })
    expect(readTableState(G1, 'boundaries')).toEqual([
      { _id: 'b1', kind: 'outOfBounds', text: 'Spiders', mine: true, mayRemove: true },
    ])
    expect(readTableState(G2, 'scene')).toBeUndefined()
    expect(getView().encounters).toEqual([])
  })

  test('a record changes or adds one; recordGone takes one away', () => {
    foldRoomMessage(G1, snapshot({ boundaries: [line('b1', 'Spiders')] }))
    const before = readTableState(G1, 'boundaries')
    expect(readTableState(G1, 'boundaries')).toBe(before)

    foldRoomMessage(G1, { type: 'record', table: 'boundaries', record: line('b2', 'Drowning') })
    foldRoomMessage(G1, { type: 'record', table: 'scene', record: scene })
    expect((readTableState(G1, 'boundaries') as { _id: string }[]).map((b) => b._id)).toEqual([
      'b1',
      'b2',
    ])
    expect(readTableState(G1, 'scene')).toEqual({ conditions: ['freezing'], hours: 2 })

    foldRoomMessage(G1, { type: 'recordGone', table: 'boundaries', appId: 'b1' })
    expect((readTableState(G1, 'boundaries') as { _id: string }[]).map((b) => b._id)).toEqual([
      'b2',
    ])
  })

  test('a fresh snapshot replaces the room’s state whole', () => {
    foldRoomMessage(G1, snapshot({ scene: [scene] }))
    foldRoomMessage(G1, snapshot({}))
    expect(readTableState(G1, 'scene')).toBeNull()
  })

  test('a Game left, or signing out, forgets its state', () => {
    foldRoomMessage(G1, snapshot({ scene: [scene] }))
    foldRoomMessage(G2, snapshot({ scene: [scene] }))
    forgetTableState(G1)
    expect(readTableState(G1, 'scene')).toBeUndefined()
    expect(readTableState(G2, 'scene')).not.toBeUndefined()
    resetReplica()
    expect(readTableState(G2, 'scene')).toBeUndefined()
  })
})

describe('a Game room’s Opposition, for its Mediator', () => {
  test('the tray reads as `mediator.npcs` answered; the one mediator record is the running encounter', () => {
    const npc = { appId: 'n1', body: { id: 'n1', name: 'Raider' }, updatedAt: 1 }
    const mediator = { appId: 'mediator', body: { running: null }, updatedAt: 0 }
    foldRoomMessage(G1, snapshot({ opposition: [npc], mediator: [mediator] }))
    expect(readTableState(G1, 'opposition')).toEqual([
      { _id: 'n1', body: { id: 'n1', name: 'Raider' } },
    ])
    expect(readTableState(G1, 'mediator')).toEqual({ running: null })
    foldRoomMessage(G2, snapshot({}))
    expect(readTableState(G2, 'opposition')).toEqual([])
    expect(readTableState(G2, 'mediator')).toBeNull()
  })
})
