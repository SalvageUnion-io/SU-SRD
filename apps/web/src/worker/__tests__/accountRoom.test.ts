import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { bodies, PLAYER, parcel } from '../../rooms/game/__tests__/harness'
import type { LeaseOutcome } from '../../rooms/handoff'
import { AccountRoom } from '../rooms'

/**
 * The account room's Durable Object layer under `bun test`, over a stand-in
 * for workerd's storage: the alarm that settles an offer its Game never answered.
 */

const namespaces = exports as Record<string, unknown>

afterEach(() => {
  delete namespaces.GameRoom
})

/** A Game room that answers `refuseLease` with `outcome`. */
function gameAnswering(outcome: LeaseOutcome) {
  namespaces.GameRoom = { getByName: () => ({ refuseLease: async () => outcome }) }
}

function shelf() {
  const db = new Database(':memory:', { strict: true })
  const state = { alarm: null as number | null }
  const ctx = {
    id: { name: PLAYER },
    storage: {
      sql: { exec: (q: string, ...b: never[]) => ({ toArray: () => db.query(q).all(...b) }) },
      transactionSync: <T>(fn: () => T) => db.transaction(fn)(),
      setAlarm: async (at: number) => {
        state.alarm = at
      },
      deleteAlarm: async () => {
        state.alarm = null
      },
      deleteAll: async () => {
        const tables = db.query("select name from sqlite_master where type = 'table'").all()
        for (const { name } of tables as { name: string }[]) db.run(`drop table "${name}"`)
      },
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    getWebSockets: () => [],
  }
  const room = new AccountRoom(ctx as never, {} as never)
  room.accept(parcel(PLAYER, 'pilot', 'p1', bodies.pilot('p1')), PLAYER, 0)
  const offer = (at: number) =>
    room.offer({
      leaseId: 'L1',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g1' },
      at,
    })
  return { room, state, offer }
}

describe('the account room’s alarm', () => {
  test('an offer the Game never took comes back to the Shelf', async () => {
    const { room, state, offer } = shelf()
    offer(Date.now() - 120_000)
    expect(state.alarm).not.toBeNull()
    gameAnswering('refused')
    state.alarm = null
    await room.alarm()
    expect(room.unitsFor(PLAYER).map((u) => u.leaseId)).toEqual([null])
    expect(state.alarm).toBeNull()
  })

  test('one the Game took leaves the Shelf', async () => {
    const { room, offer } = shelf()
    offer(Date.now() - 120_000)
    gameAnswering('accepted')
    await room.alarm()
    expect(room.unitsFor(PLAYER)).toEqual([])
  })

  test('a fresh one waits for the next alarm', async () => {
    const { room, state, offer } = shelf()
    offer(Date.now())
    state.alarm = null
    await room.alarm()
    expect(state.alarm).not.toBeNull()
    expect(room.unitsFor(PLAYER).map((u) => u.leaseId)).toEqual(['L1'])
  })
})

describe('the account room’s other doors', () => {
  test('a unit with its vitals, and a socket only for its own player', async () => {
    const { room } = shelf()
    expect(await room.unit(PLAYER, 'p1')).toMatchObject({ id: 'p1', vitals: expect.anything() })
    expect(await room.unit(PLAYER, 'nope')).toBeNull()
    expect((await room.fetch(new Request('https://room/'))).status).toBe(400)
    // A Request here drops `upgrade`, so the headers are handed in as the Worker sets them.
    const headers = new Map([
      ['x-su-member', 'd-stranger'],
      ['upgrade', 'websocket'],
    ])
    const stranger = { headers: { get: (name: string) => headers.get(name) ?? null } }
    expect((await room.fetch(stranger as never)).status).toBe(403)
    expect(room.refuseLease('L-unknown', Date.now())).toBe('refused')
  })

  test('forget wipes the Shelf for its own player only, and leaves it theirs, empty', async () => {
    const { room } = shelf()
    await room.forget('d-stranger')
    expect(room.unitsFor(PLAYER)).toHaveLength(1)
    await room.forget(PLAYER)
    expect(room.unitsFor(PLAYER)).toEqual([])
    expect(room.exportFor(PLAYER)).toMatchObject({ pilots: [], mechs: [] })
    // Signing straight back in, a Game can hand them a unit again.
    room.accept(parcel(PLAYER, 'pilot', 'p2', bodies.pilot('p2')), PLAYER, 1)
    expect(room.unitsFor(PLAYER).map((u) => u.id)).toEqual(['p2'])
  })
})
