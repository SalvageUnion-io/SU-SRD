/**
 * An edit to a unit in a Game whose socket is open goes to that room as an
 * `ops` batch, and the room's `declined` is the refusal; a unit whose room is
 * not open goes nowhere and fails as offline.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { acceptingRooms, roomAnswer, roomOps } from '../../../test/roomsStub'
import { pilotFixture } from '../../components/__tests__/fixtures'

const { openRoom, RoomDeclined } = await import('../roomSocket')
const { gameScope } = await import('../replica')
const { resetSync, setSyncStatus, WritesBlockedOffline } = await import('../sync')
const { useUnits } = await import('../units')
const { resetStores } = await import('./resetStores')

const TXN = { kind: 'manual', source: 'test' } as const

class FakeSocket {
  static readonly OPEN = 1
  static last: FakeSocket | null = null
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: { type: string; ops: { id: string; unitId: string; patch: object }[] }[] = []
  constructor() {
    FakeSocket.last = this
  }
  send(text: string) {
    this.sent.push(JSON.parse(text))
  }
  close() {}
}

const real = globalThis.WebSocket
let close = () => {}
let socket: FakeSocket

/** Answer the batch the room was just sent. */
async function answer(reply: { type: 'ack' } | { type: 'declined'; reason: string }) {
  await new Promise((resolve) => setTimeout(resolve, 0))
  const batch = socket.sent.at(-1)
  socket.onmessage?.({
    data: JSON.stringify({ ...reply, opIds: batch?.ops.map((o) => o.id) ?? [] }),
  })
}

beforeEach(async () => {
  resetStores()
  acceptingRooms()
  globalThis.WebSocket = FakeSocket as never
  window.location.href = 'http://localhost/build/'
  const units = useUnits.getState()
  await units.adopt('pilot', pilotFixture({ id: 'gp', name: 'Before', gameId: 'g1' }))
  await units.adopt('pilot', pilotFixture({ id: 'sp', name: 'Before', gameId: null }))
  setSyncStatus('live')
  close = openRoom('/__rooms/games/g1/socket', gameScope('g1'), 'g1')
  socket = FakeSocket.last as FakeSocket
  socket.readyState = FakeSocket.OPEN
  socket.onopen?.()
})

afterEach(() => {
  close()
  globalThis.WebSocket = real
  resetSync()
  acceptingRooms()
})

describe('fed by the rooms', () => {
  test('an edit to a unit in an open Game room goes to the room', async () => {
    const edit = useUnits.getState().update('pilot', 'gp', { name: 'After' }, TXN)
    await answer({ type: 'ack' })
    await edit

    expect(socket.sent).toHaveLength(1)
    expect(socket.sent[0]?.ops[0]).toMatchObject({ unitId: 'gp', patch: { name: 'After' } })
    expect(roomOps).toEqual([])
    expect(useUnits.getState().get('pilot', 'gp')?.name).toBe('After')
  })

  test('the room’s declined is the refusal', async () => {
    const edit = useUnits.getState().update('pilot', 'gp', { name: 'After' }, TXN)
    await answer({ type: 'declined', reason: 'Not yours' })
    await expect(edit).rejects.toBeInstanceOf(RoomDeclined)
  })

  test('a unit on the Shelf fails as offline while its room is not open', async () => {
    roomAnswer.open = false
    await expect(
      useUnits.getState().update('pilot', 'sp', { name: 'After' }, TXN)
    ).rejects.toBeInstanceOf(WritesBlockedOffline)
    expect(socket.sent).toEqual([])
    expect(useUnits.getState().get('pilot', 'sp')?.name).toBe('Before')
  })
})
