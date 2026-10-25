/**
 * What the room sockets say, folded into the replica (`roomSocket.ts`): each
 * room is one scope, so a Game room's answer never takes the account room's
 * rows, and a row leaves only when no room still holds it.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, FIXTURE_NOW, pilotFixture } from '../../components/__tests__/fixtures'
import { gameScope, getView, hold, setRoomScopes } from '../replica'
import { foldRoomMessage, openRoom, RoomDeclined, roomOf } from '../roomSocket'
import { WritesBlockedOffline } from '../sync'
import { resetStores } from './resetStores'

const unit = (kind: 'pilot' | 'crawler', body: { id: string }, gameId: string | null, seq = 1) => ({
  kind,
  appId: body.id,
  gameId,
  owner: 'u1',
  publicRead: false,
  body,
  headSeq: seq,
  fieldSeqs: {},
  updatedAt: seq,
})

const link = {
  id: 'l1',
  createdAt: FIXTURE_NOW,
  type: 'pilot-to-crawler',
  from: { type: 'pilot', id: 'p1' },
  to: { type: 'crawler', id: 'c1' },
}

const pattern = {
  appId: 'pat-1',
  updatedAt: 1,
  body: {
    id: 'pat-1',
    schemaVersion: 1,
    name: 'Mule Pattern',
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  },
}

const snapshot = (units: unknown[], extra: object = {}) => ({
  type: 'snapshot',
  units,
  records: {},
  links: [],
  ...extra,
})

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)
const G1 = gameScope('g1')

beforeEach(resetStores)

describe('a snapshot', () => {
  test('holds the room’s units, links and the record tables it keeps', () => {
    foldRoomMessage(
      'account',
      snapshot([unit('pilot', pilotFixture({ id: 'p1' }), null)], {
        records: { patterns: [pattern] },
      })
    )
    foldRoomMessage(
      G1,
      snapshot([unit('crawler', crawlerFixture({ id: 'c1' }), 'g1')], { links: [link] })
    )

    const view = getView()
    expect(ids(view.pilots)).toEqual(['p1'])
    expect(view.crawlers[0]?.gameId).toBe('g1')
    expect(ids(view.softLinks)).toEqual(['l1'])
    expect(ids(view.mechPatterns)).toEqual(['pat-1'])
    expect(view.hydrated.pilots).toBe(true)
  })

  test('a Game room’s answer leaves the account room’s rows alone', () => {
    foldRoomMessage('account', snapshot([unit('pilot', pilotFixture({ id: 'p1' }), null)]))
    foldRoomMessage(G1, snapshot([]))
    expect(ids(getView().pilots)).toEqual(['p1'])
  })

  test('a row it leaves out goes, once no room holds it', () => {
    foldRoomMessage(G1, snapshot([unit('crawler', crawlerFixture({ id: 'c1' }), 'g1')]))
    foldRoomMessage(G1, snapshot([]))
    expect(getView().crawlers).toEqual([])
  })
})

describe('deltas', () => {
  test('applied adopts a newer unit and never an older one', () => {
    foldRoomMessage(
      'account',
      snapshot([unit('pilot', pilotFixture({ id: 'p1', name: 'Old' }), null)])
    )
    const applied = (name: string, seq: number) => ({
      type: 'applied',
      op: {
        id: `op-${seq}`,
        unitId: 'p1',
        seq,
        baseSeq: seq - 1,
        author: 'u1',
        at: seq,
        kind: 'manual',
        source: 'sheet',
        state: 'applied',
        patch: { name },
        before: null,
      },
      unit: unit('pilot', pilotFixture({ id: 'p1', name }), null, seq),
    })
    foldRoomMessage('account', applied('New', 3))
    foldRoomMessage('account', applied('Stale', 2))
    expect(getView().pilots[0]?.name).toBe('New')
  })

  test('gone takes the room’s claim off; links replace the room’s link set', () => {
    foldRoomMessage(
      G1,
      snapshot([unit('crawler', crawlerFixture({ id: 'c1' }), 'g1')], { links: [link] })
    )
    foldRoomMessage(G1, { type: 'gone', kind: 'crawler', appId: 'c1' })
    foldRoomMessage(G1, { type: 'links', links: [] })
    expect(getView().crawlers).toEqual([])
    expect(getView().softLinks).toEqual([])
  })

  test('record and recordGone keep a record table', () => {
    foldRoomMessage('account', { type: 'record', table: 'patterns', record: pattern })
    expect(ids(getView().mechPatterns)).toEqual(['pat-1'])
    foldRoomMessage('account', { type: 'recordGone', table: 'patterns', appId: 'pat-1' })
    expect(getView().mechPatterns).toEqual([])
  })

  test('a message that does not parse changes nothing', () => {
    foldRoomMessage('account', snapshot([unit('pilot', pilotFixture({ id: 'p1' }), null)]))
    foldRoomMessage('account', { type: 'snapshot', units: 'nope' })
    foldRoomMessage('account', undefined)
    expect(ids(getView().pilots)).toEqual(['p1'])
  })
})

describe('a row this tab wrote, fed by the rooms', () => {
  test('joins its Game room’s scope, so that room’s next answer decides it', () => {
    setRoomScopes(true)
    hold('pilot', pilotFixture({ id: 'p2', gameId: 'g1' }))
    foldRoomMessage('account', snapshot([]))
    expect(ids(getView().pilots)).toEqual(['p2'])
    foldRoomMessage(G1, snapshot([]))
    expect(getView().pilots).toEqual([])
  })
})

describe('openRoom', () => {
  class FakeSocket {
    static readonly OPEN = 1
    static all: FakeSocket[] = []
    readyState = 0
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    closedWith: number | null = null
    sent: unknown[] = []
    constructor(
      readonly url: string,
      readonly protocols: string[]
    ) {
      FakeSocket.all.push(this)
    }
    send(text: string) {
      this.sent.push(JSON.parse(text))
    }
    close(code: number) {
      this.closedWith = code
    }
    opens() {
      this.readyState = FakeSocket.OPEN
      this.onopen?.()
    }
    says(message: object) {
      this.onmessage?.({ data: JSON.stringify(message) })
    }
  }

  const real = globalThis.WebSocket
  beforeEach(() => {
    globalThis.WebSocket = FakeSocket as never
    FakeSocket.all = []
    window.location.href = 'http://localhost/build/'
  })
  afterEach(() => {
    globalThis.WebSocket = real
  })

  const op = (id: string) => ({
    id,
    unitId: 'c1',
    baseSeq: 1,
    at: 1,
    kind: 'manual' as const,
    source: 'sheet',
    patch: { name: 'X' },
  })

  test('opens with the token, folds what the room says, and closes for good', () => {
    const close = openRoom('/__rooms/account/socket', 'account', 'tok')
    const socket = FakeSocket.all[0] as FakeSocket
    expect(socket.url).toBe('ws://localhost/__rooms/account/socket')
    expect(socket.protocols).toEqual(['su-room', 'tok'])
    socket.says(snapshot([unit('pilot', pilotFixture({ id: 'p1' }), null)]))
    expect(ids(getView().pilots)).toEqual(['p1'])
    close()
    socket.onclose?.()
    expect(socket.closedWith).toBe(1000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  test('while open, it is the Game’s room: a batch waits for its ack or declined', async () => {
    const close = openRoom('/__rooms/games/g1/socket', G1, 'tok', 'g1')
    const socket = FakeSocket.all[0] as FakeSocket
    expect(roomOf('g1')).toBeNull()
    socket.opens()
    const room = roomOf('g1')
    expect(room).not.toBeNull()

    const acked = room?.submit([op('o1')])
    expect(socket.sent).toEqual([{ type: 'ops', ops: [op('o1')] }])
    socket.says({ type: 'ack', opIds: ['o1'] })
    await acked

    const refused = room?.submit([op('o2')])
    socket.says({ type: 'declined', opIds: ['o2'], reason: 'Not yours' })
    await expect(refused).rejects.toThrow(new RoomDeclined('Not yours'))

    close()
    expect(roomOf('g1')).toBeNull()
  })

  test('closing the room fails a batch still waiting, never leaving it hanging', async () => {
    const close = openRoom('/__rooms/games/g1/socket', G1, 'tok', 'g1')
    ;(FakeSocket.all[0] as FakeSocket).opens()
    const sent = roomOf('g1')?.submit([op('o1')])
    close()
    await expect(sent).rejects.toBeInstanceOf(WritesBlockedOffline)
  })

  test('a batch in flight when the socket drops goes again when it reopens', async () => {
    const close = openRoom('/__rooms/games/g1/socket', G1, 'tok', 'g1')
    const first = FakeSocket.all[0] as FakeSocket
    first.opens()
    const sent = roomOf('g1')?.submit([op('o1')])
    first.onclose?.()
    expect(roomOf('g1')).toBeNull()

    await new Promise((resolve) => setTimeout(resolve, 1_050))
    const second = FakeSocket.all[1] as FakeSocket
    second.opens()
    expect(second.sent).toEqual([{ type: 'ops', ops: [op('o1')] }])
    second.says({ type: 'ack', opIds: ['o1'] })
    await sent
    close()
  })
})
