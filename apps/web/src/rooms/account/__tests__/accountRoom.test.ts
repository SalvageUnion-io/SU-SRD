import { describe, expect, test } from 'bun:test'
import type { AccountBundle } from 'game-domain/migration/bundle'
import { bunSql } from '../../__tests__/bunSql'
import { AT, bodies, op, PLAYER, STRANGER, stubApplyOp, table } from '../../game/__tests__/harness'
import type { GameRoomLogic } from '../../game/gameRoomLogic'
import type { UnitHome } from '../../handoff'
import { handOff } from '../../handoff'
import { migrate } from '../../migrate'
import { ACCOUNT_ROOM } from '../../schemas'
import { AccountRoomLogic } from '../accountRoomLogic'

let ids = 0

/** `PLAYER`'s room, holding pilot p1 boarded in mech m1 on their solo seat. */
function shelf() {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp, newId: () => `a-${++ids}` })
  room.transit.importAccount(bundle(), AT)
  return { room, sql }
}

function bundle(over: Partial<AccountBundle> = {}): AccountBundle {
  const unit = (kind: 'pilot' | 'mech', appId: string) => ({
    kind,
    appId,
    owner: PLAYER,
    publicRead: false,
    body: bodies[kind](appId) as Record<string, unknown>,
    headSeq: 0,
    fieldSeqs: {},
    updatedAt: AT,
    ops: [],
  })
  return {
    discordId: PLAYER,
    name: 'Player',
    avatarUrl: null,
    units: [unit('pilot', 'p1'), unit('mech', 'm1')],
    patterns: [{ appId: 'pat1', body: { name: 'Pattern' }, extra: {} }],
    encounters: [],
    npcTray: [],
    links: [
      { type: 'mech-to-pilot', from: { type: 'mech', id: 'm1' }, to: { type: 'pilot', id: 'p1' } },
    ],
    seats: [
      { pilotId: 'p1', mount: { kind: 'boarded', mechId: 'm1' }, range: 'Far', activeEffects: [] },
    ],
    channelBindings: [],
    ...over,
  }
}

function seatOf(sql: ReturnType<typeof bunSql>, pilotId: string) {
  const row = sql.exec<{ mount: string; range_band: string }>(
    'select * from seats where pilot_id = ?',
    pilotId
  )[0]
  return row === undefined ? null : { mount: JSON.parse(row.mount), range: row.range_band }
}

function accountHome(room: AccountRoomLogic): UnitHome {
  const t = room.transit
  return {
    offer: (args) => t.offer(args),
    accept: (parcel, actor, at) => t.accept(parcel, actor, at),
    release: (leaseId) => t.release(leaseId),
    cancel: (leaseId) => t.cancel(leaseId),
    refuseLease: (leaseId, at) => t.refuseLease(leaseId, at),
  }
}

function gameHome(room: GameRoomLogic): UnitHome {
  const t = room.transit
  return {
    offer: (args) => t.offer(args),
    accept: (parcel, actor, at) => t.accept(parcel, actor, at),
    release: (leaseId) => t.release(leaseId),
    cancel: (leaseId) => t.cancel(leaseId),
    refuseLease: (leaseId, at) => t.refuseLease(leaseId, at),
  }
}

const toG1 = { kind: 'game', gameId: 'g1' } as const

describe('the Shelf is its player’s', () => {
  test('a stranger reads nothing and writes nothing', () => {
    const { room } = shelf()
    expect(room.shelf.list(STRANGER)).toEqual([])
    expect(room.shelf.records(STRANGER, 'patterns')).toEqual([])
    expect(room.shelf.submit.bind(room.shelf, STRANGER, [op('p1', { currentHP: 1 })])).toThrow(
      /not your Training Bay/
    )
    expect(room.shelf.list(PLAYER).map((u) => u.id)).toEqual(['m1', 'p1'])
  })

  test('a batch applies all or none, and a replayed op lands once', () => {
    const { room } = shelf()
    const first = op('p1', { currentHP: 3 })
    expect(room.shelf.submit(PLAYER, [first])).toEqual({
      ok: true,
      applied: [{ id: first.id, seq: 1 }],
    })
    expect(room.shelf.submit(PLAYER, [first])).toEqual({
      ok: true,
      applied: [{ id: first.id, seq: 1 }],
    })
    const refused = room.shelf.submit(PLAYER, [op('m1', { name: 'X' }), op('p1', { invalid: 1 })])
    expect(refused).toMatchObject({ ok: false, reason: 'invalid' })
    expect(room.shelf.store.unit('m1')?.headSeq).toBe(0)
    expect(room.shelf.history(PLAYER, 'p1').map((o) => o.id)).toEqual([first.id])
  })

  test('deleting the boarded mech leaves the solo pilot on foot', () => {
    const { room, sql } = shelf()
    room.shelf.remove(PLAYER, 'm1')
    expect(seatOf(sql, 'p1')?.mount).toEqual({ kind: 'foot' })
    expect(room.shelf.links(PLAYER)).toEqual([])
  })

  test('a link to something not on the Shelf is refused', () => {
    const { room } = shelf()
    room.shelf.create(PLAYER, { id: 'm2', kind: 'mech', body: bodies.mech('m2'), at: AT })
    room.shelf.drawLink(PLAYER, {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm2' },
      to: { type: 'pilot', id: 'p1' },
    })
    expect(room.shelf.links(PLAYER).map((l) => l.from.id)).toEqual(['m2'])
    expect(() =>
      room.shelf.drawLink(PLAYER, {
        type: 'mech-to-pilot',
        from: { type: 'mech', id: 'm2' },
        to: { type: 'pilot', id: 'elsewhere' },
      })
    ).toThrow(/different places/)
  })
})

describe('what the Shelf refuses', () => {
  test('a crew slot, a mismatched link, a second kind under one id, and a move off to nowhere', () => {
    const { room } = shelf()
    expect(() =>
      room.shelf.drawLink(PLAYER, {
        type: 'npc-to-crawler',
        from: { type: 'npc', id: 'n1' },
        to: { type: 'crawler', id: 'c1' },
        slot: { kind: 'crew' } as never,
      })
    ).toThrow('Crew is assigned in a Game')
    expect(() =>
      room.shelf.drawLink(PLAYER, {
        type: 'mech-to-pilot',
        from: { type: 'pilot', id: 'p1' },
        to: { type: 'mech', id: 'm1' },
      })
    ).toThrow('cannot join')
    expect(() =>
      room.shelf.create(PLAYER, { id: 'p1', kind: 'mech', body: bodies.mech('p1'), at: AT })
    ).toThrow('already a pilot')
    room.shelf.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    expect(() =>
      room.transit.offer({
        leaseId: 'L-home',
        unitId: 'p1',
        actor: PLAYER,
        to: { kind: 'account', userId: STRANGER } as never,
        at: AT,
      })
    ).toThrow('into a Game')
    expect(room.transit.refuseLease('L-new', AT)).toBe('refused')
    expect(room.transit.refuseLease('L-new', AT)).toBe('refused')
  })
})

describe('moving between the Shelf and a Game', () => {
  test('the mech goes first and keeps the solo seat boarded; the pilot follows and sits aboard', async () => {
    const { room, sql } = shelf()
    const game = table('g1').room
    const move = (leaseId: string, unitId: string) =>
      handOff(accountHome(room), gameHome(game), {
        leaseId,
        unitId,
        actor: PLAYER,
        to: toG1,
        at: AT,
      })

    await move('L1', 'm1')
    expect(seatOf(sql, 'p1')?.mount).toEqual({ kind: 'boarded', mechId: 'm1' })
    await move('L2', 'p1')

    expect(room.shelf.list(PLAYER)).toEqual([])
    expect(seatOf(sql, 'p1')).toBeNull()
    expect(game.play.seat('p1')).toMatchObject({
      mount: { kind: 'boarded', mechId: 'm1' },
      range: 'Far',
    })
  })

  test('only the player moves it, and a Game that refuses leaves it on the Shelf, writable', async () => {
    const { room } = shelf()
    const game = table('g1').room
    const move = (actor: string) =>
      handOff(accountHome(room), gameHome(game), {
        leaseId: `L-${actor}`,
        unitId: 'p1',
        actor,
        to: toG1,
        at: AT,
      })
    await expect(move(STRANGER)).rejects.toThrow(/not your Training Bay/)
    game.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    await expect(move(PLAYER)).rejects.toThrow(/already in this Game/)
    expect(room.shelf.store.unit('p1')?.leaseId).toBeNull()
    expect(room.shelf.submit(PLAYER, [op('p1', { currentHP: 2 })])).toMatchObject({ ok: true })
  })

  test('a unit comes back from a Game with its history', async () => {
    const { room } = shelf()
    const game = table('g1').room
    await handOff(accountHome(room), gameHome(game), {
      leaseId: 'L1',
      unitId: 'p1',
      actor: PLAYER,
      to: toG1,
      at: AT,
    })
    game.units.submit(PLAYER, [op('p1', { currentHP: 2 })])
    await handOff(gameHome(game), accountHome(room), {
      leaseId: 'L2',
      unitId: 'p1',
      actor: PLAYER,
      to: { kind: 'account', userId: PLAYER },
      at: AT,
    })
    expect(room.shelf.store.unit('p1')).toMatchObject({ ownerId: PLAYER, headSeq: 1 })
    expect(room.shelf.history(PLAYER, 'p1')).toHaveLength(1)
    expect(game.units.list(PLAYER).some((u) => u.id === 'p1')).toBe(false)
  })
})

describe('a disbanded Game’s Opposition', () => {
  test('files in the tray once per lease', () => {
    const { room } = shelf()
    const npc = { id: 'n1', name: 'Raider' }
    room.transit.fileTray('disband-tray:g1', [npc], AT)
    room.transit.fileTray('disband-tray:g1', [{ id: 'n2' }], AT)
    expect(room.shelf.records(PLAYER, 'npcTray')).toEqual([{ appId: 'n1', body: npc }])
    expect(() => room.transit.fileTray('other', [{ name: 'no id' }], AT)).toThrow(/carries its id/)
  })
})

describe('the cutover import', () => {
  test('is whole, and a rerun takes nothing', () => {
    const { room } = shelf()
    expect(room.transit.diffImport(bundle())).toEqual([])
    expect(room.transit.importAccount(bundle({ units: [] }), AT)).toEqual({ imported: false })
    expect(room.shelf.records(PLAYER, 'patterns')).toEqual([
      { appId: 'pat1', body: { name: 'Pattern', id: 'pat1' } },
    ])
  })

  test('refuses another player’s bundle and a malformed one', () => {
    const { room } = shelf()
    expect(() => room.transit.importAccount(bundle({ discordId: STRANGER }), AT)).toThrow(
      /PLAYER|d-player/
    )
    expect(() => room.transit.importAccount({ discordId: PLAYER }, AT)).toThrow()
  })
})
