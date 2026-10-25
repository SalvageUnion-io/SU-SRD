import { afterEach, describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { bunSql } from '../../rooms/__tests__/bunSql'
import { GameRoom, serveGameSocket, serveRoomsHealth } from '../rooms'

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

type Sock = { tags: string[]; sent: string[]; send: (text: string) => void }

function sock(...tags: string[]): Sock {
  const s: Sock = { tags, sent: [], send: (text) => s.sent.push(text) }
  return s
}

/** A Game room over bun:sqlite, holding `sockets` as its hibernated ones. */
function gameRoom(sockets: Sock[]) {
  const sql = bunSql()
  const ctx = {
    storage: {
      sql: { exec: (q: string, ...b: never[]) => ({ toArray: () => sql.exec(q, ...b) }) },
      transactionSync: <T>(fn: () => T) => sql.transaction(fn),
    },
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    getWebSockets: () => sockets,
    getTags: (ws: Sock) => ws.tags,
  }
  return new GameRoom(ctx as never, {} as never)
}

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
  const env = { CONVEX_URL: 'https://convex.example' }
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const TOKEN = `${b64({ alg: 'RS256' })}.${b64({ sub: 'user1|session9' })}.sig`
  const upgrade = (seat: string) =>
    new Request(`https://salvageunion.io/__rooms/games/g1/socket?seat=${seat}`, {
      headers: { upgrade: 'websocket', 'sec-websocket-protocol': `su-room, ${TOKEN}` },
    })
  const realFetch = globalThis.fetch
  const pageRequest = globalThis.Request

  afterEach(() => {
    globalThis.fetch = realFetch
    globalThis.Request = pageRequest
  })

  function convexAnswers(value: unknown) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: 'success', value }))) as unknown as typeof fetch
  }

  test('wants an upgrade', async () => {
    expect((await serveGameSocket(new Request('https://x/'), 'g1', env)).status).toBe(426)
  })

  test('refuses someone outside the Game', async () => {
    convexAnswers(null)
    expect((await serveGameSocket(upgrade('1'), 'g1', env)).status).toBe(403)
  })

  test('hands a member to the Game’s room, saying who and how', async () => {
    convexAnswers({ _id: 'g1' })
    globalThis.Request = Request
    let forwarded: Request | undefined
    namespaces.GameRoom = {
      getByName: (name: string) => ({
        fetch: async (req: Request) => {
          forwarded = req
          return new Response(name)
        },
      }),
    }
    const res = await serveGameSocket(upgrade('1'), 'g1', env)
    expect(await res.text()).toBe('g1')
    expect(forwarded?.headers.get('x-su-member')).toBe('user1')
    expect(forwarded?.headers.get('x-su-seat')).toBe('1')
    await serveGameSocket(upgrade('yes'), 'g1', env)
    expect(forwarded?.headers.get('x-su-seat')).toBe('0')
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
