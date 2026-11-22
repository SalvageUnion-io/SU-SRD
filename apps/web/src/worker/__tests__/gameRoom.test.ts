import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { exports } from 'cloudflare:workers'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import type { UnitParcel } from '../../rooms/handoff'
import { GameRoom } from '../rooms'
import { testDb } from '../shared/__tests__/d1'

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

function room(gameId: string, env: Record<string, unknown> = {}) {
  const store = storage()
  const waiting: Promise<unknown>[] = []
  const ctx = {
    id: { name: gameId },
    storage: store,
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    getWebSockets: () => [],
    waitUntil: (promise: Promise<unknown>) => void waiting.push(promise),
  }
  const game = new GameRoom(ctx as never, env as never)
  made.set(gameId, game)
  return { game, store, waiting }
}

/** Shelves the Game room hands units to, recording what each was given. */
const shelves = new Map<string, { parcels: UnitParcel[]; left: string[] }>()
Object.assign(exports, {
  GameRoom: { getByName: (name: string) => made.get(name) },
  AccountRoom: {
    getByName: (userId: string) => {
      const shelf = shelves.get(userId) ?? { parcels: [], left: [] }
      shelves.set(userId, shelf)
      return {
        accept: async (parcel: UnitParcel) => void shelf.parcels.push(parcel),
        leftGame: async (gameId: string) => void shelf.left.push(gameId),
      }
    },
  },
})

async function seeded(gameId: string, env: Record<string, unknown> = {}) {
  const made = room(gameId, env)
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
    // What was on the field went with the Game (MD3-03): a shelf here has no
    // act that takes a tray, so handing one over would have failed the ending.
    expect(shelves.get(ORGANIZER)?.parcels.map((p) => p.unit.kind)).not.toContain('npc')
    // Each member's room drops the Game from its list.
    expect(shelves.get(ORGANIZER)?.left).toEqual(['g-end'])
    expect(shelves.get(PLAYER)?.left).toEqual(['g-end'])
    expect(game.act(ORGANIZER, 'read', undefined as never)).toEqual({ ok: true, value: null })
  })

  test('a member leaves, or the Organiser removes them: their units go home, never deleted (MD-11)', async () => {
    shelves.clear()
    const { game } = await seeded('g-leave')
    // The Organiser stays: the Game is theirs to delete.
    expect(await game.dismiss(ORGANIZER, ORGANIZER)).toEqual({
      ok: false,
      refusal: 'The Organiser cannot leave their own Game: delete it instead',
    })
    // Nobody but the Organiser removes someone else.
    expect(await game.dismiss(PLAYER, ORGANIZER)).toMatchObject({ ok: false })
    expect(await game.dismiss('d-stranger', PLAYER)).toEqual({
      ok: false,
      refusal: 'Not a member of this Game',
    })
    expect(await game.dismiss(PLAYER, PLAYER)).toEqual({ ok: true, value: null })
    expect(shelves.get(PLAYER)?.parcels.map((p) => p.unit.id)).toEqual(['p1'])
    expect(shelves.get(PLAYER)?.left).toEqual(['g-leave'])
    expect(await game.unit(ORGANIZER, 'p1')).toBeNull()
    expect(game.act(PLAYER, 'read', undefined as never)).toEqual({ ok: true, value: null })
    expect(game.act(ORGANIZER, 'read', undefined as never)).toMatchObject({
      ok: true,
      value: { memberCount: 1 },
    })
  })

  // Seen in the two-account walk: a leaver's pilot came home without its mech
  // assigned. Each unit left alone, so the pairing was dropped with the first.
  test('a leaver’s pilot and mech go home still assigned to each other', async () => {
    shelves.clear()
    const { game } = await seeded('g-pair')
    const mech = mechFixture({ id: 'm1', name: 'Mech m1', chassisRef: 'iron-mongrel' })
    game.act(PLAYER, 'createUnit', { id: 'm1', kind: 'mech', body: mech })
    const pairing = {
      type: 'mech-to-pilot' as const,
      from: { type: 'mech' as const, id: 'm1' },
      to: { type: 'pilot' as const, id: 'p1' },
    }
    expect(game.act(PLAYER, 'drawLink', { link: pairing })).toMatchObject({ ok: true })
    expect(await game.dismiss(PLAYER, PLAYER)).toEqual({ ok: true, value: null })
    // Both parcels carry the pairing, so the Training Bay keeps it once it
    // holds both ends (the second to arrive: `AccountTransit.accept`).
    const pairings = (p: UnitParcel) => p.links.filter((l) => l.type === 'mech-to-pilot').length
    const home = shelves.get(PLAYER)?.parcels.map((p) => [p.unit.id, pairings(p)])
    expect(home?.sort()).toEqual([
      ['m1', 1],
      ['p1', 1],
    ])
    expect(await game.unit(ORGANIZER, 'p1')).toBeNull()
    expect(await game.unit(ORGANIZER, 'm1')).toBeNull()
  })

  test('the Organiser removes a member the same way', async () => {
    shelves.clear()
    const { game } = await seeded('g-remove')
    expect(await game.dismiss(ORGANIZER, PLAYER)).toEqual({ ok: true, value: null })
    expect(shelves.get(PLAYER)?.parcels.map((p) => p.unit.id)).toEqual(['p1'])
    expect(game.act(ORGANIZER, 'members', undefined as never)).toMatchObject({
      ok: true,
      value: [{ userId: ORGANIZER }],
    })
  })

  /** A Game from the Starter Set template, a player joined; its pre-gens arrive unassigned. */
  async function fromTemplate(gameId: string) {
    const { game, store } = room(gameId)
    game.act(ORGANIZER, 'createFromTemplate', {
      templateId: 'starter-set',
      profile: profile('Org'),
    })
    const code = game.act(ORGANIZER, 'inviteCode', undefined as never)
    if (!code.ok) throw new Error(code.refusal)
    game.act(PLAYER, 'redeem', { code: code.value, profile: profile('Player') })
    const read = () => {
      const answer = game.act(ORGANIZER, 'read', undefined as never)
      if (!answer.ok || answer.value === null) throw new Error('no Game')
      return answer.value
    }
    /** Every pilot and mech in the room: its id, kind and holder. */
    const units = () =>
      (
        store.sql
          .exec("select id, kind, owner_id from units where kind != 'crawler'")
          .toArray() as {
          id: string
          kind: string
          owner_id: string | null
        }[]
      ).sort((a, b) => a.id.localeCompare(b.id))
    const pilots = units()
      .filter((unit) => unit.kind === 'pilot')
      .map((unit) => unit.id)
    return { game, read, units, pilots }
  }

  // LG4-03: removing a player took the Game's own pre-generated Pilot and Mech with them.
  test('removing a player leaves the Game’s own Pilots here, unassigned; what they brought goes home', async () => {
    shelves.clear()
    const { game, read, units, pilots } = await fromTemplate('g-pregen')
    const pregen = pilots[0] as string
    const before = units()
    expect(read().templateUnitIds?.slice().sort()).toEqual(before.map((unit) => unit.id))
    expect(game.act(ORGANIZER, 'assign', { unitId: pregen, userId: PLAYER }).ok).toBe(true)
    // The mech it came with was handed out with it.
    expect(
      units()
        .filter((unit) => unit.owner_id === PLAYER)
        .map((unit) => unit.kind)
        .sort()
    ).toEqual(['mech', 'pilot'])
    const own = pilotFixture({ id: 'p-own', name: 'Own', callsign: 'OWN', classRef: 'salvager' })
    game.act(PLAYER, 'createUnit', { id: 'p-own', kind: 'pilot', body: own })

    expect(await game.dismiss(ORGANIZER, PLAYER)).toEqual({ ok: true, value: null })
    // Only what they brought went to their Training Bay.
    expect(shelves.get(PLAYER)?.parcels.map((p) => p.unit.id)).toEqual(['p-own'])
    // The Game's own are all still here, and nobody holds them.
    expect(units()).toEqual(before)
    expect(units().every((unit) => unit.owner_id === null)).toBe(true)
    expect(read().templateUnitIds?.slice().sort()).toEqual(before.map((unit) => unit.id))
  })

  test('a player who leaves on their own leaves the Game’s Pilots too', async () => {
    shelves.clear()
    const { game, units, pilots } = await fromTemplate('g-pregen-leave')
    const before = units()
    expect(game.act(PLAYER, 'assign', { unitId: pilots[0] as string }).ok).toBe(true)
    expect(await game.dismiss(PLAYER, PLAYER)).toEqual({ ok: true, value: null })
    expect(shelves.get(PLAYER)?.parcels ?? []).toEqual([])
    expect(units()).toEqual(before)
  })

  // LG4-20: spare pre-gens stayed in the crew list and in the seats for good.
  test('the Organiser takes an unused pre-gen and its mech off the roster, to their Training Bay', async () => {
    shelves.clear()
    const { game, read, units, pilots } = await fromTemplate('g-shelve')
    const [spare, taken] = pilots as [string, string]
    const before = read()
    const kind = new Map(units().map((unit) => [unit.id, unit.kind]))
    // Not a player's to do, and not one a player holds.
    expect(await game.shelve(PLAYER, spare)).toMatchObject({ ok: false })
    expect(game.act(ORGANIZER, 'assign', { unitId: taken, userId: PLAYER }).ok).toBe(true)
    expect(await game.shelve(ORGANIZER, taken)).toEqual({
      ok: false,
      refusal: 'That Pilot is assigned to a player: unassign it first',
    })

    const went = await game.shelve(ORGANIZER, spare)
    if (!went.ok) throw new Error(went.refusal)
    expect(went.value.map((id) => kind.get(id)).sort()).toEqual(['mech', 'pilot'])
    const parcels = shelves.get(ORGANIZER)?.parcels ?? []
    expect(parcels.map((p) => p.unit.id).sort()).toEqual([...went.value].sort())
    // Both arrive the Organiser's, still assigned to each other.
    for (const parcel of parcels) {
      expect(parcel.unit.ownerId).toBe(ORGANIZER)
      expect(parcel.links.filter((l) => l.type === 'mech-to-pilot')).toHaveLength(1)
    }
    // Seats count only the Pilots still on the roster.
    expect(read().pilotCount).toBe(before.pilotCount - 1)
    expect(read().mechCount).toBe(before.mechCount - 1)
    expect(units().some((unit) => went.value.includes(unit.id))).toBe(false)
  })

  test('a Pilot the Game did not come with is never taken off this way', async () => {
    const { game } = await seeded('g-shelve-own')
    expect(await game.shelve(ORGANIZER, 'p1')).toEqual({
      ok: false,
      refusal: 'Only a Pilot this Game came with can be taken off its roster',
    })
  })

  test('a Game whose last member leaves is wiped', async () => {
    const { game } = await seeded('g-forget')
    await game.forget(PLAYER)
    expect(await game.unit(ORGANIZER, 'p1')).toBeNull()
    await game.forget(ORGANIZER)
    expect(game.act(ORGANIZER, 'read', undefined as never)).toEqual({ ok: true, value: null })
  })

  test('a Downtime begun and a group session started each count once toward the weekly usage signals', async () => {
    const db = testDb()
    const { game } = await seeded('g-usage', { SHARED: db })
    game.act(ORGANIZER, 'setMediator', { userId: ORGANIZER, mediator: true })
    expect(game.act(ORGANIZER, 'downtime.begin', undefined as never)).toEqual({
      ok: true,
      value: true,
    })
    // A second press while it runs begins nothing, so counts nothing.
    expect(game.act(ORGANIZER, 'downtime.begin', undefined as never)).toEqual({
      ok: true,
      value: false,
    })
    // A group session started counts too, once.
    expect(game.act(ORGANIZER, 'session.start', undefined as never)).toEqual({
      ok: true,
      value: true,
    })
    game.act(ORGANIZER, 'session.start', undefined as never)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(db.sqlite.query('select key, count from usage_counts order by key').all()).toEqual([
      { key: 'downtime:game', count: 1 },
      { key: 'session:game', count: 1 },
    ])
  })

  test('a Stop Sign is posted after the act, at most once a minute', async () => {
    const made = await seeded('g-stop')
    const { game, waiting } = made
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
    expect(game.act(PLAYER, 'safety.showStop', undefined as never)).toEqual({
      ok: true,
      value: false,
    })
    expect(waiting).toHaveLength(1)
  })

  test('the Mediator’s alert is posted after the act; a refused one is not', async () => {
    const { game, waiting } = await seeded('g-alert')
    expect(game.act(PLAYER, 'changeLog.broadcast', { message: 'Dust storm' })).toMatchObject({
      ok: false,
    })
    expect(waiting).toHaveLength(0)
    game.act(ORGANIZER, 'setMediator', { userId: ORGANIZER, mediator: true })
    expect(game.act(ORGANIZER, 'changeLog.broadcast', { message: 'Dust storm' })).toMatchObject({
      ok: true,
    })
    expect(waiting).toHaveLength(1)
    await Promise.all(waiting)
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
