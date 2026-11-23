import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

/**
 * A roll held offline reaches the table (r7 B3): back online the screen is
 * writable a moment before the Game's own socket reopens, and the held roll
 * waits for that room, staying "Not sent yet" until its log row has landed.
 */

import { acceptingRooms, roomAnswer } from '../../../test/roomsStub'
import { gameScope } from '../../replica/replica'
import { openRoom } from '../../replica/roomSocket'
import { resetSync, setSyncStatus } from '../../replica/sync'
import { SyncContext } from '../../replica/syncContext'
import { clearPlayRolls, recordPlayRoll } from '../playRolls.model'
import { usePlayRollDispatch } from '../usePlayChannel'

/** A Game room's socket that opens only when the test says. */
class OpeningSocket {
  static readonly OPEN = 1
  static last: OpeningSocket | null = null
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  acts: { id: string; name: string }[] = []
  constructor() {
    OpeningSocket.last = this
  }
  send(text: string) {
    const said = JSON.parse(text) as { type: string; id: string; name: string }
    if (said.type !== 'act') return
    this.acts.push(said)
    queueMicrotask(() =>
      this.onmessage?.({ data: JSON.stringify({ type: 'answered', id: said.id, value: null }) })
    )
  }
  close() {}
}

const real = globalThis.WebSocket
let closeRoom = () => {}

beforeEach(() => {
  acceptingRooms()
  clearPlayRolls()
  // No stand-in for the Game: only its own socket can take the roll.
  roomAnswer.open = (gameId) => gameId !== 'g1'
  globalThis.WebSocket = OpeningSocket as never
})

afterEach(() => {
  closeRoom()
  globalThis.WebSocket = real
  resetSync()
  acceptingRooms()
  clearPlayRolls()
})

function renderDispatch() {
  let canWrite = false
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SyncContext.Provider
      value={{ status: canWrite ? 'live' : 'offline', canWrite, outdated: false }}
    >
      {children}
    </SyncContext.Provider>
  )
  const hook = renderHook(
    () =>
      usePlayRollDispatch({
        target: { gameId: 'g1', pilotId: 'p1' },
        rollerName: 'Rook',
        binding: null,
      }),
    { wrapper }
  )
  return {
    ...hook,
    online: (writersFirst = true) => {
      canWrite = true
      if (writersFirst) setSyncStatus('live')
      hook.rerender()
    },
  }
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('a roll held offline (r7 B3)', () => {
  test('waits for the Game room still opening on reconnect, then lands', async () => {
    setSyncStatus('offline')
    const { result, online } = renderDispatch()
    let roll = { id: '' }
    act(() => {
      roll = recordPlayRoll({
        tableName: 'Core Mechanic',
        rolls: [10],
        label: 'Core Mechanic',
        outcome: 'Tough Choice',
      })
    })
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'held' })

    // Back online: the Game's socket is still opening.
    closeRoom = openRoom('http://localhost/__rooms/games/g1/socket', gameScope('g1'), 'g1')
    const socket = OpeningSocket.last as OpeningSocket
    online()
    await flush()
    expect(socket.acts).toEqual([])
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'held' })

    await act(async () => {
      socket.readyState = OpeningSocket.OPEN
      socket.onopen?.()
    })
    await flush()
    expect(socket.acts.map((a) => a.name)).toEqual(['changeLog.appendChangeLog'])
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'unbound' })
  })

  test('a room that never opens keeps the roll held, and it goes when the room does', async () => {
    setSyncStatus('offline')
    const { result, online } = renderDispatch()
    let roll = { id: '' }
    act(() => {
      roll = recordPlayRoll({ tableName: 'Core Mechanic', rolls: [4], label: 'Core Mechanic' })
    })
    // Online, with no room open or coming (its reconnect is backing off).
    online()
    await flush()
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'held' })

    closeRoom = openRoom('http://localhost/__rooms/games/g1/socket', gameScope('g1'), 'g1')
    const socket = OpeningSocket.last as OpeningSocket
    await act(async () => {
      socket.readyState = OpeningSocket.OPEN
      socket.onopen?.()
    })
    await flush()
    expect(socket.acts.map((a) => a.name)).toEqual(['changeLog.appendChangeLog'])
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'unbound' })
  })

  test('the screen is writable before the writers are: it goes when they are', async () => {
    setSyncStatus('offline')
    closeRoom = openRoom('http://localhost/__rooms/games/g1/socket', gameScope('g1'), 'g1')
    const socket = OpeningSocket.last as OpeningSocket
    socket.readyState = OpeningSocket.OPEN
    socket.onopen?.()
    const { result, online } = renderDispatch()
    let roll = { id: '' }
    act(() => {
      roll = recordPlayRoll({ tableName: 'Core Mechanic', rolls: [12], label: 'Core Mechanic' })
    })
    // `SyncProvider` publishes the status after the screen's own effects run.
    online(false)
    await flush()
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'held' })
    await act(async () => setSyncStatus('live'))
    await flush()
    expect(socket.acts.map((a) => a.name)).toEqual(['changeLog.appendChangeLog'])
    expect(result.current.posts.get(roll.id)).toEqual({ kind: 'unbound' })
  })
})
