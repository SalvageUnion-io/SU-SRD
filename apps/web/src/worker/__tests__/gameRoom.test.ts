import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { UnitParcel } from '../../rooms/handoff'
import { GameRoom } from '../rooms'

/**
 * The Game room's Durable Object layer under `bun test`, over a stand-in for
 * workerd's storage; `workerd/gameRoom.workerd.ts` runs the same room for
 * real. What is checked here is the wiring: the room's name, its clock, the
 * alarm, and the calls it makes to other rooms.
 */

const ORGANIZER = 'd-org'
const PLAYER = 'd-player'
const profile = (displayName: string) => ({ displayName, avatarUrl: null })

/** workerd's storage, as much of it as a room touches. */
function storage() {
  const db = new Database(':memory:', { strict: true })
  const state = { alarm: null as number | null }
  return {
    state,
    sql: { exec: (query: string, ...b: never[]) => ({ toArray: () => db.query(query).all(...b) }) },
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
  }
}

const made = new Map<string, GameRoom>()

function room(gameId: string) {
  const store = storage()
  const waiting: Promise<unknown>[] = []
  const ctx = {
    id: { name: gameId },
    storage: store,
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    getWebSockets: () => [],
    waitUntil: (promise: Promise<unknown>) => void waiting.push(promise),
  }
  const game = new GameRoom(ctx as never, {} as never)
  made.set(gameId, game)
  return { game, store, waiting }
}

/** Shelves the Game room hands units to, recording what each was given. */
const shelves = new Map<string, { parcels: UnitParcel[]; trays: unknown[] }>()
Object.assign(exports, {
  GameRoom: { getByName: (name: string) => made.get(name) },
  AccountRoom: {
    getByName: (userId: string) => {
      const shelf = shelves.get(userId) ?? { parcels: [], trays: [] }
      shelves.set(userId, shelf)
      return {
        accept: async (parcel: UnitParcel) => void shelf.parcels.push(parcel),
        fileTray: async (_lease: string, npcs: unknown[]) => void shelf.trays.push(npcs),
      }
    },
  },
})

async function seeded(gameId: string) {
  const made = room(gameId)
  const { game } = made
  game.act(ORGANIZER, 'create', { name: 'Tenacity', profile: profile('Org') })
  const code = game.act(ORGANIZER, 'inviteCode', undefined as never)
  if (!code.ok) throw new Error(code.refusal)
  game.act(PLAYER, 'redeem', { code: code.value, profile: profile('Player') })
  const body = pilotFixture({ id: 'p1', name: 'Pilot p1', callsign: 'p1', classRef: 'salvager' })
  game.act(PLAYER, 'createUnit', { id: 'p1', kind: 'pilot', body })
  return made
}

describe('the Game room Durable Object', () => {
  test('acts under its own name, with the real applyOp', async () => {
    const { game } = await seeded('g-acts')
    expect(game.health().schema).toBeGreaterThan(0)
    expect(game.act(PLAYER, 'read', undefined as never)).toMatchObject({
      ok: true,
      value: { gameId: 'g-acts', name: 'Tenacity' },
    })
    const op = {
      id: 'op-1',
      unitId: 'p1',
      baseSeq: 0,
      at: 0,
      kind: 'manual' as const,
      source: 'live-sheet',
      patch: { motto: 'Keep moving' },
    }
    expect(game.act(PLAYER, 'submit', { ops: [op] })).toMatchObject({
      ok: true,
      value: { ok: true },
    })
    expect(game.unitsFor(PLAYER)).toMatchObject([{ id: 'p1', body: { motto: 'Keep moving' } }])
    expect(game.unitsFor('d-stranger')).toEqual([])
    expect(await game.unit(PLAYER, 'p1')).toMatchObject({
      ownerName: 'Player',
      vitals: { kind: 'pilot' },
    })
    expect(await game.unit('d-stranger', 'p1')).toBeNull()
  })

  test('an offer sets the alarm, and the alarm settles it back home', async () => {
    const { game: from, store } = await seeded('g-from')
    await seeded('g-to')
    from.offer({
      leaseId: 'L1',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g-to' },
      at: Date.now() - 120_000,
    })
    expect(store.state.alarm).not.toBeNull()
    await from.alarm()
    expect(await from.unit(PLAYER, 'p1')).not.toBeNull()
    const op = { id: 'op-back', unitId: 'p1', baseSeq: null, at: 0, kind: 'manual' as const }
    expect(
      from.act(PLAYER, 'submit', { ops: [{ ...op, source: 'live-sheet', patch: { motto: 'x' } }] })
    ).toMatchObject({ ok: true, value: { ok: true } })
  })

  test('the alarm leaves a fresh offer for later, and the move lands', async () => {
    const { game: from, store } = await seeded('g-fresh')
    const { game: to } = await seeded('g-fresh-to')
    const parcel = from.offer({
      leaseId: 'L2',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g-fresh-to' },
      at: Date.now(),
    })
    store.state.alarm = null
    await from.alarm()
    expect(store.state.alarm).not.toBeNull()
    to.act(PLAYER, 'removeUnit', { unitId: 'p1' })
    to.accept(parcel, PLAYER, Date.now())
    expect(to.refuseLease('L2', Date.now())).toBe('accepted')
    from.release('L2')
    from.cancel('L2')
    expect(await from.unit(PLAYER, 'p1')).toBeNull()
    expect(await to.unit(PLAYER, 'p1')).not.toBeNull()
  })

  test('ending a Game hands everything to a Training Bay and wipes the room', async () => {
    const { game } = await seeded('g-end')
    game.act(ORGANIZER, 'setMediator', { userId: ORGANIZER, mediator: true })
    game.act(ORGANIZER, 'mediator.addNpc', { body: { name: 'Raider' } })
    expect(await game.disband(PLAYER)).toEqual({
      ok: false,
      refusal: 'Only the Organiser can do that',
    })
    expect(await game.disband(ORGANIZER)).toEqual({ ok: true, value: null })
    expect(shelves.get(PLAYER)?.parcels.map((p) => p.unit.id)).toEqual(['p1'])
    // Each NPC keeps its id, which the shelf files it by.
    expect(shelves.get(ORGANIZER)?.trays).toMatchObject([
      [{ id: expect.any(String), name: 'Raider' }],
    ])
    expect(game.act(ORGANIZER, 'read', undefined as never)).toEqual({ ok: true, value: null })
  })

  test('a Game whose last member leaves is wiped', async () => {
    const { game } = await seeded('g-forget')
    await game.forget(PLAYER)
    expect(await game.unit(ORGANIZER, 'p1')).toBeNull()
    await game.forget(ORGANIZER)
    expect(game.act(ORGANIZER, 'read', undefined as never)).toEqual({ ok: true, value: null })
  })

  test('a Stop Sign on a table that opted in is posted after the act', async () => {
    const made = await seeded('g-stop')
    const { game, waiting } = made
    game.act(PLAYER, 'safety.showStop', undefined as never)
    expect(waiting).toHaveLength(0)
    game.act(PLAYER, 'safety.liftStop', undefined as never)
    game.act(ORGANIZER, 'safety.setPostToChannel', { on: true })
    expect(game.act(PLAYER, 'safety.showStop', undefined as never)).toEqual({
      ok: true,
      value: true,
    })
    expect(waiting).toHaveLength(1)
    // No relay configured: the post is skipped, and the game stays paused.
    await Promise.all(waiting)
    expect(game.act(PLAYER, 'safety.stopSign', undefined as never)).toMatchObject({
      value: { stop: { mine: true } },
    })
    game.act(PLAYER, 'safety.liftStop', undefined as never)
    game.act(ORGANIZER, 'safety.setPostToChannel', { on: false })
    expect(game.act(PLAYER, 'safety.showStop', undefined as never)).toEqual({
      ok: true,
      value: false,
    })
  })

  test('a lease the alarm cannot settle is logged and tried again; a socket needs the Worker’s headers', async () => {
    const { game, store } = await seeded('g-lost')
    game.offer({
      leaseId: 'L-lost',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'game', gameId: 'g-nowhere' },
      at: Date.now() - 120_000,
    })
    store.state.alarm = null
    await game.alarm()
    expect(store.state.alarm).not.toBeNull()
    const plain = await game.fetch(new Request('https://room/'))
    expect(plain.status).toBe(400)
  })

  test('a room reached without a name is a defect', () => {
    const ctx = { id: {}, storage: storage(), blockConcurrencyWhile: async () => {} }
    const nameless = new GameRoom(ctx as never, {} as never)
    expect(() => nameless.act(PLAYER, 'read', undefined as never)).toThrow('by its Game id')
  })
})
