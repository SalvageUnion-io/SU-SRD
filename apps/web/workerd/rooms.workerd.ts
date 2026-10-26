import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import { ACCOUNT_ROOM, GAME_ROOM } from '../src/rooms/schemas'
import type { AccountRoom, GameRoom } from '../src/worker/rooms'

/** Typed here, not by `worker-configuration.d.ts`, whose main module drags in the app. */
const exports = workerExports as unknown as {
  AccountRoom: DurableObjectNamespace<AccountRoom>
  GameRoom: DurableObjectNamespace<GameRoom>
  default: Fetcher
}

describe('rooms', () => {
  it('each kind opens, migrated, over RPC', async () => {
    expect(await exports.AccountRoom.getByName('a').health()).toEqual({
      schema: ACCOUNT_ROOM.length,
    })
    expect(await exports.GameRoom.getByName('g').health()).toEqual({ schema: GAME_ROOM.length })
  })

  it('migrates its own storage and keeps it across eviction', async () => {
    const room = exports.GameRoom.getByName('kept')
    await runInDurableObject(room, (_instance, state) => {
      state.storage.sql.exec('create table kept (x integer)')
    })
    await evictDurableObject(room)
    await runInDurableObject(room, (_instance, state) => {
      const tables = state.storage.sql
        .exec(
          "select name from sqlite_master where type = 'table' and name in ('kept', 'room_schema')"
        )
        .toArray()
      expect(tables.map((t) => t.name).sort()).toEqual(['kept', 'room_schema'])
    })
  })

  it('answers the health route through the Worker', async () => {
    const res = await exports.default.fetch('https://salvageunion.io/__rooms/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      account: { schema: ACCOUNT_ROOM.length },
      game: { schema: GAME_ROOM.length },
    })
  })

  it('tells every socket who is here, and who has gone', async () => {
    const room = exports.GameRoom.getByName('table')
    const open = async (member: string, seat: '0' | '1') => {
      const res = await room.fetch('https://room/', {
        headers: { upgrade: 'websocket', 'x-su-member': member, 'x-su-seat': seat },
      })
      const ws = res.webSocket
      if (ws === null) throw new Error('no socket')
      const heard: string[][] = []
      ws.addEventListener('message', (e) => heard.push(JSON.parse(String(e.data)).here))
      ws.accept()
      return { ws, heard }
    }
    // Until each socket has heard it: a close reaches the room on its own time.
    const until = (check: () => void) => vi.waitFor(check, { timeout: 2000, interval: 20 })

    const watcher = await open('mediator', '0')
    const player = await open('player', '1')
    await until(() => {
      expect(watcher.heard.at(-1)).toEqual(['player'])
      expect(player.heard.at(-1)).toEqual(['player'])
    })

    player.ws.close(1000)
    await until(() => expect(watcher.heard.at(-1)).toEqual([]))
  })

  it('opens its player’s account socket on their Shelf, and no one else’s', async () => {
    const room = exports.AccountRoom.getByName('d-rook')
    const open = (member: string) =>
      room.fetch('https://room/', { headers: { upgrade: 'websocket', 'x-su-member': member } })
    expect((await open('d-wren')).status).toBe(403)
    const ws = (await open('d-rook')).webSocket
    if (ws === null) throw new Error('no socket')
    const heard: unknown[] = []
    ws.addEventListener('message', (e) => heard.push(JSON.parse(String(e.data))))
    ws.accept()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(heard).toEqual([{ type: 'snapshot', units: [], records: expect.any(Object), links: [] }])
    ws.close(1000)
  })

  it('refuses a socket with no member token', async () => {
    const res = await exports.default.fetch('https://salvageunion.io/__rooms/games/g/socket', {
      headers: { upgrade: 'websocket' },
    })
    expect(res.status).toBe(403)
  })

  it('refuses an account socket with no session', async () => {
    const res = await exports.default.fetch('https://salvageunion.io/__rooms/account/socket', {
      headers: { upgrade: 'websocket' },
    })
    expect(res.status).toBe(403)
  })
})
