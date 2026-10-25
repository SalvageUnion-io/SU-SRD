import { evictDurableObject, runInDurableObject } from 'cloudflare:test'
import { exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
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
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

    const watcher = await open('mediator', '0')
    const player = await open('player', '1')
    await settle()
    expect(watcher.heard.at(-1)).toEqual(['player'])
    expect(player.heard.at(-1)).toEqual(['player'])

    player.ws.close(1000)
    await settle()
    expect(watcher.heard.at(-1)).toEqual([])
  })

  it('refuses a socket with no member token', async () => {
    const res = await exports.default.fetch('https://salvageunion.io/__rooms/games/g/socket', {
      headers: { upgrade: 'websocket' },
    })
    expect(res.status).toBe(403)
  })
})
