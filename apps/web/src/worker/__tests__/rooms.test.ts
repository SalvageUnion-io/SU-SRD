import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { crawlerFixture, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { bunSql } from '../../rooms/__tests__/bunSql'
import { parcel } from '../../rooms/game/__tests__/harness'
import { ROOM_GONE } from '../../rooms/protocol'
import { serveAccountSocket, serveGameSocket, serveRoomsHealth } from '../roomRoutes'
import { AccountRoom, GameRoom } from '../rooms'

/**
 * The rooms' Worker side under `bun test`, against a stand-in Durable Object
 * state: what the Worker lets through to a Game room, and what the room tells
 * its sockets when one closes. The sockets themselves, and a 101, need
 * workerd (`workerd/rooms.workerd.ts`).
 */

// happy-dom's Request drops `Sec-` headers, as a browser's must; the Worker's never does.
const { Request } = NATIVE_FETCH_GLOBALS

const namespaces = exports as Record<string, unknown>

afterEach(() => {
  delete namespaces.GameRoom
  delete namespaces.AccountRoom
})

type Sock = {
  tags: string[]
  sent: string[]
  closed: number | null
  send: (text: string) => void
  close: (code: number) => void
}

function sock(...tags: string[]): Sock {
  const s: Sock = {
    tags,
    sent: [],
    closed: null,
    send: (text) => s.sent.push(text),
    close: (code) => {
      s.closed = code
    },
  }
  return s
}

/** A stand-in Durable Object state over bun:sqlite, holding `sockets` as its hibernated ones. */
function roomState(sockets: Sock[], name?: string) {
  const sql = bunSql()
  return {
    id: { name },
    storage: {
      sql: { exec: (q: string, ...b: never[]) => ({ toArray: () => sql.exec(q, ...b) }) },
      transactionSync: <T>(fn: () => T) => sql.transaction(fn),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    getWebSockets: () => sockets,
    getTags: (ws: Sock) => ws.tags,
  }
}

function gameRoom(sockets: Sock[]) {
  return new GameRoom(roomState(sockets) as never, {} as never)
}

describe('an account room', () => {
  const received = (s: Sock) =>
    s.sent.map((m) => JSON.parse(m) as { type: string; [key: string]: unknown })
  const shelf = (...sockets: Sock[]) => {
    const room = new AccountRoom(roomState(sockets, 'd-rook') as never, {} as never)
    const body = pilotFixture({ id: 'p1', name: 'Pilot', callsign: 'p1', classRef: 'salvager' })
    room.accept(parcel('d-rook', 'pilot', 'p1', body), 'd-rook', 0)
    for (const socket of sockets) socket.sent.length = 0
    return room
  }

  test('is its player’s from the start, so a Game can hand them a unit before they open it', () => {
    const room = new AccountRoom(roomState([], 'd-rook') as never, {} as never)
    expect(() => room.fileTray('disband-tray:g1', [{ id: 'n1', name: 'Raider' }], 1)).not.toThrow()
    expect(room.unitsFor('d-rook')).toEqual([])
  })

  test('opens a socket for its player only', async () => {
    const upgrade = (member: string) =>
      new Request('https://x/', { headers: { upgrade: 'websocket', 'x-su-member': member } })
    expect((await shelf().fetch(upgrade('d-wren'))).status).toBe(403)
    expect((await shelf().fetch(new Request('https://x/'))).status).toBe(400)
  })

  test('its player’s batch is acked and heard as applied; a tray filed sends the Shelf', () => {
    const rook = sock('d-rook')
    const room = shelf(rook)
    const op = { id: 'op-1', unitId: 'p1', baseSeq: 0, at: 0, kind: 'manual', source: 'live-sheet' }
    room.webSocketMessage(
      rook as never,
      JSON.stringify({ type: 'ops', ops: [{ ...op, patch: { motto: 'Up' } }] })
    )
    expect(received(rook).map((m) => m.type)).toEqual(['applied', 'ack'])
    rook.sent.length = 0
    room.fileTray('disband-tray:g1', [{ id: 'n1', name: 'Raider' }], 5)
    expect(received(rook)).toEqual([
      expect.objectContaining({
        type: 'snapshot',
        units: [expect.objectContaining({ appId: 'p1', gameId: null, headSeq: 1 })],
        records: expect.objectContaining({
          npcTray: [{ appId: 'n1', body: { id: 'n1', name: 'Raider' }, updatedAt: 5 }],
        }),
      }),
    ])
  })

  test('a batch from anyone else, or a message it cannot read, is declined', () => {
    const wren = sock('d-wren')
    const room = shelf(wren)
    const op = {
      id: 'op-2',
      unitId: 'p1',
      baseSeq: 0,
      at: 0,
      kind: 'manual',
      source: 'live-sheet',
      patch: {},
    }
    room.webSocketMessage(wren as never, JSON.stringify({ type: 'ops', ops: [op] }))
    room.webSocketMessage(wren as never, '{}')
    expect(received(wren)).toEqual([
      expect.objectContaining({ type: 'declined', opIds: ['op-2'] }),
      expect.objectContaining({ type: 'declined', opIds: [] }),
    ])
  })

  test('its player’s solo area acts are answered, and their Shelf carries the area', async () => {
    const rook = sock('d-rook')
    const room = shelf(rook)
    const act = (id: string, name: string, args?: unknown) =>
      room.webSocketMessage(rook as never, JSON.stringify({ type: 'act', id, name, args }))
    act('a-1', 'salvageAreas.set', { area: { name: 'Yard', techLevel: 3, supply: 1 } })
    act('a-2', 'salvageAreas.spend', { pilotId: 'p1' })
    act('a-3', 'salvageAreas.spend', { pilotId: 'p1' })
    act('a-4', 'scenes.passHour')
    // An account room's acts answer once their (possibly awaited) work is done.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const heard = received(rook)
    expect(heard.filter((m) => m.type !== 'snapshot')).toEqual([
      { type: 'answered', id: 'a-1' },
      { type: 'answered', id: 'a-2', value: { techLevel: 3, supply: 0 } },
      { type: 'refused', id: 'a-3', reason: 'This area is picked clean' },
      { type: 'refused', id: 'a-4', reason: 'Not an act this room takes' },
    ])
    expect(heard.filter((m) => m.type === 'snapshot').at(-1)).toMatchObject({
      records: { salvageArea: [{ appId: 'salvageArea', body: { name: 'Yard', supply: 0 } }] },
    })
  })

  test('its player makes, wires and deletes units by act; a stranger is refused', () => {
    const rook = sock('d-rook')
    const wren = sock('d-wren')
    const room = shelf(rook, wren)
    const act = (who: Sock, id: string, name: string, args?: unknown) =>
      room.webSocketMessage(who as never, JSON.stringify({ type: 'act', id, name, args }))
    const body = mechFixture({ id: 'm1', chassisRef: 'mule' })
    const link = {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
    }
    act(rook, 'a-1', 'createUnit', { id: 'm1', kind: 'mech', body })
    act(rook, 'a-2', 'drawLink', { link })
    expect(
      room
        .unitsFor('d-rook')
        .map((u) => u.id)
        .sort()
    ).toEqual(['m1', 'p1'])
    expect(
      received(rook)
        .filter((m) => m.type === 'snapshot')
        .at(-1)
    ).toMatchObject({
      links: [expect.objectContaining({ type: 'mech-to-pilot' })],
    })
    act(wren, 'a-3', 'removeUnit', { unitId: 'm1' })
    act(rook, 'a-4', 'removeUnit', { unitId: 'm1' })
    expect(room.unitsFor('d-rook').map((u) => u.id)).toEqual(['p1'])
    expect(received(rook).filter((m) => m.type !== 'snapshot')).toEqual([
      { type: 'answered', id: 'a-1' },
      { type: 'answered', id: 'a-2' },
      { type: 'answered', id: 'a-4' },
    ])
    expect(received(wren).filter((m) => m.type !== 'snapshot')).toEqual([
      { type: 'refused', id: 'a-3', reason: 'That is not your Training Bay' },
    ])
  })
})

describe('a Game room’s socket', () => {
  const received = (s: Sock) =>
    s.sent.map((m) => JSON.parse(m) as { type: string; [key: string]: unknown })
  function seated() {
    const org = sock('d-org', 'seat')
    const player = sock('d-player', 'watch')
    // A socket opened before its member left: it hears nothing the members do.
    const left = sock('d-left', 'watch')
    const room = new GameRoom(roomState([org, player, left], 'g1') as never, {} as never)
    const profile = { displayName: 'Org', avatarUrl: null }
    room.act('d-org', 'create', { name: 'Tenacity', profile })
    const code = room.act('d-org', 'inviteCode', undefined as never)
    if (!code.ok) throw new Error(code.refusal)
    room.act('d-player', 'redeem', { code: code.value, profile })
    const body = pilotFixture({ id: 'p1', name: 'Pilot', callsign: 'p1', classRef: 'salvager' })
    room.act('d-player', 'createUnit', { id: 'p1', kind: 'pilot', body })
    org.sent.length = 0
    player.sent.length = 0
    left.sent.length = 0
    return { room, org, player, left }
  }
  const batch = (id: string) =>
    JSON.stringify({
      type: 'ops',
      ops: [
        {
          id,
          unitId: 'p1',
          baseSeq: 0,
          at: 0,
          kind: 'manual',
          source: 'live-sheet',
          patch: { motto: 'Up' },
        },
      ],
    })

  test('an act that changes the Game sends every socket its snapshot', () => {
    const { room, org, player } = seated()
    room.act('d-player', 'removeUnit', { unitId: 'p1' })
    expect(received(org)).toMatchObject([
      { type: 'snapshot', units: [], records: { opposition: [] }, links: [] },
    ])
    expect(received(player).map((m) => m.type)).toEqual(['snapshot'])
    room.act('d-player', 'read', undefined as never)
    expect(player.sent).toHaveLength(1)
  })

  test('an ops batch is acked to its sender and heard by all as applied, with the crew’s vitals', () => {
    const { room, org, player, left } = seated()
    room.webSocketMessage(player as never, batch('op-1'))
    expect(left.sent).toEqual([])
    expect(received(player).map((m) => m.type)).toEqual(['applied', 'record', 'ack'])
    expect(received(org)).toEqual([
      expect.objectContaining({
        type: 'applied',
        unit: expect.objectContaining({ appId: 'p1', headSeq: 1 }),
      }),
      expect.objectContaining({
        type: 'record',
        table: 'crew',
        record: expect.objectContaining({
          body: expect.objectContaining({ pilots: [expect.objectContaining({ _id: 'p1' })] }),
        }),
      }),
    ])
  })

  test('a Downtime step’s op sends the Game again, so its step reads as taken', () => {
    const { room, org, player } = seated()
    room.webSocketMessage(player as never, batch('downtime:run:p1:0'))
    expect(received(org).map((m) => m.type)).toEqual(['applied', 'snapshot'])
  })

  test('a batch the room refuses, or a message it cannot read, is declined', () => {
    const { room, org } = seated()
    const stranger = sock('d-stranger', 'watch')
    room.webSocketMessage(stranger as never, batch('op-2'))
    room.webSocketMessage(org as never, 'not json')
    expect(received(stranger)).toEqual([
      expect.objectContaining({ type: 'declined', opIds: ['op-2'] }),
    ])
    expect(received(org)).toEqual([expect.objectContaining({ type: 'declined', opIds: [] })])
  })

  const act = (id: string, name: string, args?: unknown) =>
    JSON.stringify({ type: 'act', id, name, args })

  test('a replayed batch is taken only on the sender’s own units', () => {
    const { room, org } = seated()
    const body = crawlerFixture({ id: 'c1', name: 'Tenacity' })
    room.act('d-org', 'createUnit', { id: 'c1', kind: 'crawler', body })
    org.sent.length = 0
    const op = (id: string, replayed: boolean) =>
      JSON.stringify({
        type: 'ops',
        ...(replayed ? { replayed: true } : {}),
        ops: [
          { id, unitId: 'c1', baseSeq: 0, at: 0, kind: 'manual', source: 'live-sheet', patch: {} },
        ],
      })
    room.webSocketMessage(org as never, op('op-r', true))
    room.webSocketMessage(org as never, op('op-l', false))
    expect(received(org).filter((m) => m.type === 'ack' || m.type === 'declined')).toEqual([
      expect.objectContaining({ type: 'declined', opIds: ['op-r'] }),
      { type: 'ack', opIds: ['op-l'], fresh: ['op-l'] },
    ])
  })

  test('a message the room fails on is still answered, without the failure’s words', () => {
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const rook = sock('u1', 'seat')
      // A room with no Game id: every act fails, as a defect does.
      const room = gameRoom([rook])
      room.webSocketMessage(rook as never, act('a-1', 'safety.liftStop'))
      room.webSocketMessage(rook as never, batch('op-1'))
      expect(received(rook)).toEqual([
        { type: 'refused', id: 'a-1', reason: 'Something went wrong' },
        { type: 'declined', opIds: ['op-1'], reason: 'Something went wrong' },
      ])
      expect(errors).toHaveBeenCalledTimes(2)
    } finally {
      errors.mockRestore()
    }
  })

  test('a member who leaves for good hears the Game emptied, and their socket closes for good', async () => {
    const { room, org, player } = seated()
    await room.forget('d-player')
    expect(received(player)).toEqual([{ type: 'snapshot', units: [], records: {}, links: [] }])
    expect(player.closed).toBe(ROOM_GONE)
    expect(org.closed).toBeNull()
  })

  test('an act is answered to its sender, and every socket hears the Game change', () => {
    const { room, org, player } = seated()
    const boundary = { kind: 'offCamera', text: 'Spiders' }
    room.webSocketMessage(player as never, act('a-1', 'safety.addBoundary', boundary))
    expect(received(player).map((m) => m.type)).toEqual(['snapshot', 'answered'])
    expect(received(player).at(-1)).toMatchObject({ type: 'answered', id: 'a-1' })
    expect(received(org)).toMatchObject([
      { type: 'snapshot', records: { boundaries: [{ body: { text: 'Spiders', mine: false } }] } },
    ])
  })

  test('an act the room refuses, or will not take from a socket, is refused by id', () => {
    const { room, player } = seated()
    room.webSocketMessage(player as never, act('a-2', 'scenes.passHour'))
    room.webSocketMessage(
      player as never,
      act('a-3', 'setMediator', { userId: 'p1', mediator: true })
    )
    room.webSocketMessage(player as never, act('a-4', 'salvageAreas.spend', { pilot: 'p1' }))
    expect(received(player)).toEqual([
      expect.objectContaining({ type: 'refused', id: 'a-2' }),
      { type: 'refused', id: 'a-3', reason: 'Not an act this room takes' },
      { type: 'refused', id: 'a-4', reason: 'Not what that act takes' },
    ])
  })
})

describe('a Game room’s presence', () => {
  test('a closing socket leaves, and everyone left hears who is here', () => {
    const watcher = sock('u9', 'watch')
    const rook = sock('u1', 'seat')
    const wren = sock('u2', 'seat')
    const throws = {
      ...sock('u3', 'seat'),
      send: () => {
        throw new Error('closing')
      },
    }
    const room = gameRoom([watcher, rook, wren, throws])
    room.webSocketClose(wren as never)
    room.webSocketError(throws as never)
    expect(watcher.sent.map((m) => JSON.parse(m))).toEqual([
      { type: 'presence', here: ['u1', 'u3'] },
      { type: 'presence', here: ['u1', 'u2'] },
    ])
    // The stand-in keeps listing wren, so only the first answer skips it.
    expect(wren.sent).toHaveLength(1)
  })

  test('refuses a request the Worker did not let through', async () => {
    const res = await gameRoom([]).fetch(
      new Request('https://x/', { headers: { upgrade: 'websocket' } })
    )
    expect(res.status).toBe(400)
  })
})

describe('serveGameSocket', () => {
  const env = { SHARED: {} as never }
  const upgrade = (seat: string, origin = 'https://salvageunion.io') =>
    new Request(`https://salvageunion.io/__rooms/games/g1/socket?seat=${seat}`, {
      headers: { upgrade: 'websocket', origin },
    })
  const signedIn = async () => ({ accountId: 'a1', discordId: 'd-rook', admin: false })
  const pageRequest = globalThis.Request

  afterEach(() => {
    globalThis.Request = pageRequest
  })

  /** The Game's room: it reads `game` to its member, and records what it is handed. */
  function room(game: unknown) {
    const seen: { forwarded?: Request } = {}
    namespaces.GameRoom = {
      getByName: (name: string) => ({
        act: async () => ({ ok: true, value: game }),
        fetch: async (req: Request) => {
          seen.forwarded = req
          return new Response(name)
        },
      }),
    }
    return seen
  }

  test('wants an upgrade', async () => {
    expect((await serveGameSocket(new Request('https://x/'), 'g1', env, signedIn)).status).toBe(426)
  })

  test('refuses someone signed out, or outside the Game', async () => {
    room({ _id: 'g1' })
    expect((await serveGameSocket(upgrade('1'), 'g1', env, async () => null)).status).toBe(403)
    room(null)
    expect((await serveGameSocket(upgrade('1'), 'g1', env, signedIn)).status).toBe(403)
  })

  test('refuses a member’s socket opened by another site’s page', async () => {
    room({ _id: 'g1' })
    const res = await serveGameSocket(
      upgrade('1', 'https://elsewhere.example'),
      'g1',
      env,
      signedIn
    )
    expect(res.status).toBe(403)
  })

  test('hands a member to the Game’s room, saying who and how', async () => {
    globalThis.Request = Request
    const seen = room({ _id: 'g1' })
    const res = await serveGameSocket(upgrade('1'), 'g1', env, signedIn)
    expect(await res.text()).toBe('g1')
    expect(seen.forwarded?.headers.get('x-su-member')).toBe('d-rook')
    expect(seen.forwarded?.headers.get('x-su-seat')).toBe('1')
    await serveGameSocket(upgrade('yes'), 'g1', env, signedIn)
    expect(seen.forwarded?.headers.get('x-su-seat')).toBe('0')
  })
})

describe('serveAccountSocket', () => {
  const env = { SHARED: {} as never }
  const upgrade = (origin = 'https://salvageunion.io') =>
    new Request('https://salvageunion.io/__rooms/account/socket', {
      headers: { upgrade: 'websocket', origin },
    })
  const signedIn = async () => ({ accountId: 'a1', discordId: 'd-rook', admin: false })
  const signedOut = async () => null
  const pageRequest = globalThis.Request

  afterEach(() => {
    globalThis.Request = pageRequest
  })

  test('wants an upgrade', async () => {
    const res = await serveAccountSocket(new Request('https://x/'), env, signedIn)
    expect(res.status).toBe(426)
  })

  test('refuses someone signed out', async () => {
    expect((await serveAccountSocket(upgrade(), env, signedOut)).status).toBe(403)
  })

  test('refuses a socket opened by another site’s page, however signed in', async () => {
    const res = await serveAccountSocket(upgrade('https://elsewhere.example'), env, signedIn)
    expect(res.status).toBe(403)
  })

  test('hands the player to their own room, by Discord id', async () => {
    globalThis.Request = Request
    let forwarded: Request | undefined
    namespaces.AccountRoom = {
      getByName: (name: string) => ({
        fetch: async (req: Request) => {
          forwarded = req
          return new Response(name)
        },
      }),
    }
    const res = await serveAccountSocket(upgrade(), env, signedIn)
    expect(await res.text()).toBe('d-rook')
    expect(forwarded?.headers.get('x-su-member')).toBe('d-rook')
  })
})

describe('serveRoomsHealth', () => {
  test('answers each room’s schema, or 503 when a room is down', async () => {
    namespaces.AccountRoom = { getByName: () => ({ health: async () => ({ schema: 0 }) }) }
    namespaces.GameRoom = { getByName: () => ({ health: async () => ({ schema: 0 }) }) }
    expect(await (await serveRoomsHealth()).json()).toEqual({
      account: { schema: 0 },
      game: { schema: 0 },
    })
    delete namespaces.GameRoom
    const original = console.error
    console.error = () => undefined
    expect((await serveRoomsHealth()).status).toBe(503)
    console.error = original
  })
})
