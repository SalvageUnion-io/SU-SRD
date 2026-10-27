import { describe, expect, test } from 'bun:test'
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

describe('the invite URL', () => {
  test('one code per Game, minted once; joining twice is not an error', () => {
    const { room, code } = table()
    expect(room.roster.inviteCode(ORGANIZER, AT)).toBe(code)
    expect(() => room.roster.inviteCode(PLAYER, AT)).toThrow('Only the Organiser')
    expect(room.roster.invitePreview(` ${code.toLowerCase()} `)).toEqual({
      gameName: 'Tenacity',
      invitedBy: 'Org',
    })
    expect(room.roster.redeem(PLAYER, code, profile('Player'), AT)).toBe('already')
  })

  test('a reset stops every old code, but nobody seated is removed', () => {
    const { room, code } = table()
    const { code: next, revoked } = room.roster.resetInvite(ORGANIZER, AT + 10)
    expect(revoked).toEqual([code])
    expect(room.roster.invitePreview(code)).toBeNull()
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
    expect(first.tray.npcs.map((n) => n.name)).toEqual(['Raider'])
    expect(() => room.units.submit(PLAYER, [])).not.toThrow()
    expect(() =>
      room.units.create(PLAYER, { id: 'p3', kind: 'pilot', body: bodies.pilot('p3'), at: AT })
    ).toThrow('This Game is ending')
    expect(room.roster.invitePreview(room.roster.read(ORGANIZER)?.gameId ?? '')).toBeNull()
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
