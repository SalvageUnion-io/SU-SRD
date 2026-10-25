import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { bodies, PLAYER } from '../../rooms/game/__tests__/harness'
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
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
  }
  const room = new AccountRoom(ctx as never, {} as never)
  room.importAccount({
    discordId: PLAYER,
    name: 'Player',
    avatarUrl: null,
    units: [
      {
        kind: 'pilot',
        appId: 'p1',
        owner: PLAYER,
        publicRead: false,
        body: bodies.pilot('p1'),
        headSeq: 0,
        fieldSeqs: {},
        updatedAt: 0,
        ops: [],
      },
    ],
    patterns: [],
    encounters: [],
    npcTray: [],
    links: [],
    seats: [],
    channelBindings: [],
  })
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
