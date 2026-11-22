import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import {
  AT,
  bodies,
  emptyRoom,
  MEDIATOR,
  ORGANIZER,
  PLAYER,
  profile,
  STRANGER,
  table,
} from './harness'

describe('making a Game', () => {
  test('its maker is the Organizer and plays; nobody mediates yet', () => {
    const { room } = emptyRoom()
    room.roster.create(ORGANIZER, {
      gameId: 'g1',
      name: '  Tenacity ',
      profile: profile('Org'),
      at: AT,
    })
    expect(room.roster.read(ORGANIZER)).toMatchObject({
      gameId: 'g1',
      name: 'Tenacity',
      organizer: true,
      mediator: false,
      tableRunner: true,
      memberCount: 1,
      crawlerName: null,
    })
    expect(() =>
      emptyRoom().room.roster.create(ORGANIZER, {
        gameId: 'g2',
        name: ' ',
        profile: profile('O'),
        at: AT,
      })
    ).toThrow('A Game needs a name')
  })

  test('a stranger cannot tell the Game exists', () => {
    const { room } = table()
    expect(room.roster.read(STRANGER)).toBeNull()
    expect(room.roster.members(STRANGER)).toEqual([])
  })

  test('appointing a Mediator takes the table back from the Organizer at once', () => {
    const { room } = table('g1', { mediator: false })
    expect(room.roster.read(ORGANIZER)?.tableRunner).toBe(true)
    expect(() => room.roster.setMediator(PLAYER, PLAYER, true)).toThrow('Only the Organiser')
    room.roster.setMediator(ORGANIZER, PLAYER, true)
    expect(room.roster.read(ORGANIZER)?.tableRunner).toBe(false)
    expect(room.roster.read(PLAYER)?.tableRunner).toBe(true)
  })
})

describe("a Game's settings and plan (ADR-067)", () => {
  test('the Organiser renames it and says what it is; nobody else does', () => {
    const { room } = table()
    expect(() => room.roster.updateSettings(PLAYER, { name: 'Mine' })).toThrow('Only the Organiser')
    room.roster.updateSettings(ORGANIZER, { name: '  Rust Coast ', description: ' A long haul. ' })
    expect(room.roster.read(PLAYER)).toMatchObject({
      name: 'Rust Coast',
      description: 'A long haul.',
    })
    expect(() => room.roster.updateSettings(ORGANIZER, { name: ' ' })).toThrow(
      'A Game needs a name'
    )
    expect(() => room.roster.updateSettings(ORGANIZER, { description: 'x'.repeat(281) })).toThrow(
      'at most 280'
    )
    // Blank clears it; the name is left alone.
    room.roster.updateSettings(ORGANIZER, { description: '  ' })
    expect(room.roster.read(PLAYER)).toMatchObject({ name: 'Rust Coast', description: null })
  })

  test("the plan is the table runner's alone, and reads empty until written", () => {
    const { room } = table()
    expect(room.plan.read(MEDIATOR)).toEqual({ schemaVersion: 1, notes: '', sessions: [] })
    expect(() => room.plan.read(PLAYER)).toThrow()
    const plan = {
      schemaVersion: 1 as const,
      notes: 'The Glass Wastes.',
      sessions: [{ id: 's1', date: '2026-12-01', title: 'The crossing', note: 'Ambush at dusk.' }],
    }
    expect(() => room.plan.write(PLAYER, plan, AT)).toThrow()
    room.plan.write(MEDIATOR, plan, AT)
    expect(room.plan.read(MEDIATOR)).toEqual(plan)
    // A scene may name an encounter: the shape is there for the next layer.
    const withScene = {
      ...plan,
      sessions: [{ ...plan.sessions[0], scenes: [{ id: 'c1', title: 'Dusk', encounterId: 'e1' }] }],
    }
    room.plan.write(MEDIATOR, withScene, AT + 1)
    expect(room.plan.read(MEDIATOR).sessions[0]?.scenes).toEqual([
      { id: 'c1', title: 'Dusk', encounterId: 'e1' },
    ])
  })
})

describe('a plan’s notes are their author’s (ADR-067 §4, r2 B3)', () => {
  const plan = {
    schemaVersion: 1 as const,
    notes: 'Vex works for the corpo.',
    sessions: [{ id: 's1', date: '2026-12-01', title: 'The crossing', note: 'Ambush at dusk.' }],
  }
  const handOver = (room: ReturnType<typeof table>['room'], to: string, from: string) => {
    const c = { room, actor: ORGANIZER, gameId: 'g1', at: AT + 5 }
    expect(runAct(c, 'setMediator', { userId: to, mediator: true }).ok).toBe(true)
    expect(runAct(c, 'setMediator', { userId: from, mediator: false }).ok).toBe(true)
  }

  test('handing the table over shows the next Mediator the sessions and no note', () => {
    const { room } = table()
    room.plan.write(MEDIATOR, plan, AT)
    handOver(room, PLAYER, MEDIATOR)
    expect(room.plan.read(PLAYER)).toEqual({
      schemaVersion: 1,
      notes: '',
      sessions: [{ id: 's1', date: '2026-12-01', title: 'The crossing', note: '' }],
    })
    // What the new Mediator writes is theirs, and the first one's is kept for them.
    room.plan.write(
      PLAYER,
      { ...plan, notes: 'Mine now.', sessions: [{ ...plan.sessions[0], note: '' }] },
      AT + 6
    )
    handOver(room, MEDIATOR, PLAYER)
    expect(room.plan.read(MEDIATOR)).toEqual(plan)
    handOver(room, PLAYER, MEDIATOR)
    expect(room.plan.read(PLAYER).notes).toBe('Mine now.')
  })

  test('notes kept before they had authors belong to whoever ran the table then', () => {
    const { room, sql } = table()
    // A row as it was written before notes had authors.
    sql.exec('insert into plan (id, body, updated_at) values (1, ?, ?)', JSON.stringify(plan), AT)
    expect(room.plan.read(MEDIATOR)).toEqual(plan)
    handOver(room, PLAYER, MEDIATOR)
    expect(room.plan.read(PLAYER).notes).toBe('')
    expect(room.plan.read(PLAYER).sessions[0]?.note).toBe('')
    room.plan.write(PLAYER, { ...plan, notes: 'New hand.' }, AT + 7)
    handOver(room, MEDIATOR, PLAYER)
    expect(room.plan.read(MEDIATOR)).toEqual(plan)
  })

  // MD4-17: the dialog promised the notes stay theirs, and no door reached them.
  test('a former Mediator reads back what they wrote, and only that', () => {
    const { room } = table()
    expect(room.plan.readOwn(MEDIATOR)).toBeNull()
    room.plan.write(MEDIATOR, plan, AT)
    handOver(room, PLAYER, MEDIATOR)
    // Their notes, each session's with its day; the title is the table's, not theirs to read now.
    expect(room.plan.readOwn(MEDIATOR)).toEqual({
      notes: 'Vex works for the corpo.',
      sessions: [{ date: '2026-12-01', note: 'Ambush at dusk.' }],
    })
    // The new Mediator wrote nothing, and reads nobody else's.
    expect(room.plan.readOwn(PLAYER)).toBeNull()
    expect(() => room.plan.readOwn('stranger')).toThrow()
  })

  test('notes kept before they had authors are read back by whoever ran the table then', () => {
    const { room, sql } = table()
    sql.exec('insert into plan (id, body, updated_at) values (1, ?, ?)', JSON.stringify(plan), AT)
    // No author yet: a player is never handed them.
    expect(room.plan.readOwn(PLAYER)).toBeNull()
    handOver(room, PLAYER, MEDIATOR)
    expect(room.plan.readOwn(MEDIATOR)?.notes).toBe('Vex works for the corpo.')
    expect(room.plan.readOwn(PLAYER)).toBeNull()
  })

  test('a session removed takes every author’s note for it', () => {
    const { room } = table()
    room.plan.write(MEDIATOR, plan, AT)
    handOver(room, PLAYER, MEDIATOR)
    room.plan.write(PLAYER, { schemaVersion: 1, notes: '', sessions: [] }, AT + 6)
    handOver(room, MEDIATOR, PLAYER)
    expect(room.plan.read(MEDIATOR)).toEqual({ schemaVersion: 1, notes: plan.notes, sessions: [] })
  })

  test('any member reads the coming session days, and nothing else of the plan', () => {
    const { room } = table()
    room.plan.write(
      MEDIATOR,
      {
        ...plan,
        sessions: [
          ...plan.sessions,
          { id: 's0', date: '2026-11-01', note: 'Past.' },
          { id: 's2', note: 'Undated.' },
        ],
      },
      AT
    )
    // A day's grace: a member west of the room is still in yesterday.
    expect(room.roster.read(PLAYER, Date.UTC(2026, 10, 21))?.sessionDays).toEqual(['2026-12-01'])
    expect(room.roster.read(PLAYER, Date.UTC(2026, 11, 2, 12))?.sessionDays).toEqual(['2026-12-01'])
    expect(room.roster.read(PLAYER, Date.UTC(2026, 11, 3))?.sessionDays).toEqual([])
  })
})

describe('the invite URL', () => {
  test('one code per Game, minted once; joining twice is not an error', () => {
    const { room, code } = table()
    expect(room.roster.inviteCode(ORGANIZER, AT)).toBe(code)
    expect(() => room.roster.inviteCode(PLAYER, AT)).toThrow('Only the Organiser')
    expect(room.roster.redeem(PLAYER, ` ${code.toLowerCase()} `, profile('Player'), AT)).toBe(
      'already'
    )
    expect(room.roster.redeem(PLAYER, code, profile('Player'), AT)).toBe('already')
  })

  test('a reset stops every old code, but nobody seated is removed', () => {
    const { room, code } = table()
    const { code: next, revoked } = room.roster.resetInvite(ORGANIZER, AT + 10)
    expect(revoked).toEqual([code])
    expect(() => room.roster.redeem(STRANGER, code, profile('S'), AT)).toThrow('no longer works')
    expect(room.roster.redeem(PLAYER, code, profile('Player'), AT)).toBe('already')
    expect(room.roster.redeem(STRANGER, next, profile('S'), AT)).toBe('joined')
    expect(() => room.roster.redeem(STRANGER, 'NOPE', profile('S'), AT)).toThrow('not valid')
  })

  test('a profile change reaches the roster', () => {
    const { room } = table()
    room.roster.updateProfile(PLAYER, { displayName: 'Rook', avatarUrl: 'https://a/b.png' })
    expect(room.roster.members(ORGANIZER).find((m) => m.userId === PLAYER)).toMatchObject({
      displayName: 'Rook',
      avatarUrl: 'https://a/b.png',
    })
  })
})

describe('ending a Game', () => {
  test('everything somebody built goes to a Training Bay, and the Game refuses all else', () => {
    const { room } = table()
    room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    room.units.create(PLAYER, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT })
    room.units.unassign(PLAYER, 'p2', AT)
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    room.opposition.addNpc(MEDIATOR, { name: 'Raider' }, AT)

    expect(() => room.roster.disband(MEDIATOR, AT)).toThrow('Only the Organiser')
    const first = room.roster.disband(ORGANIZER, AT)
    expect(first.deliveries.map((d) => [d.parcel.unit.id, d.to]).sort()).toEqual([
      ['c1', ORGANIZER],
      ['p1', PLAYER],
      ['p2', ORGANIZER],
    ])
    expect(first.deliveries[0]?.parcel.links).toEqual([])
    // MD3-03: what is on the field goes with the Game, handed to nobody.
    expect(first).toEqual({ deliveries: first.deliveries })
    expect(() => room.units.submit(PLAYER, [])).not.toThrow()
    expect(() =>
      room.units.create(PLAYER, { id: 'p3', kind: 'pilot', body: bodies.pilot('p3'), at: AT })
    ).toThrow('This Game is ending')
    // Asked again, it answers the same leases, so a retry delivers each once.
    expect(room.roster.disband(ORGANIZER, AT + 1).deliveries.map((d) => d.parcel.leaseId)).toEqual(
      first.deliveries.map((d) => d.parcel.leaseId)
    )
  })

  test('a deleted account takes its builds, and the Organizer flag passes on', () => {
    const { room } = table()
    room.units.create(ORGANIZER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    expect(room.roster.forgetMember(ORGANIZER)).toEqual({ empty: false })
    expect(room.units.list(PLAYER).map((u) => u.id)).toEqual(['c1'])
    expect(room.roster.read(PLAYER)?.organizer).toBe(true)
    room.roster.forgetMember(PLAYER)
    expect(room.roster.forgetMember(MEDIATOR)).toEqual({ empty: true })
  })
})
