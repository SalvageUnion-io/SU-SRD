import { describe, expect, test } from 'bun:test'
import type { UnitHome, UnitParcel } from '../../handoff'
import { handOff, settleLease } from '../../handoff'
import type { GameRoomLogic } from '../gameRoomLogic'
import { AT, bodies, MEDIATOR, ORGANIZER, op, PLAYER, STRANGER, table } from './harness'

/** A Game room as the other side of a handoff sees it. */
function home(room: GameRoomLogic): UnitHome {
  return {
    offer: (args) => room.transit.offer(args),
    accept: (parcel, actor, at) => room.transit.accept(parcel, actor, at),
    release: (leaseId) => room.transit.release(leaseId),
    cancel: (leaseId) => room.transit.cancel(leaseId),
    refuseLease: (leaseId, at) => room.transit.refuseLease(leaseId, at),
  }
}

/** Two Games the player and Mediator both play in, the player's pilot and mech in the first. */
function twoGames() {
  const a = table('g1').room
  const b = table('g2').room
  a.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  a.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  a.units.drawLink(PLAYER, {
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'm1' },
    to: { type: 'pilot', id: 'p1' },
  })
  a.units.submit(PLAYER, [op('p1', { currentHP: 4 })])
  return { a, b }
}

const toG2 = { kind: 'game', gameId: 'g2' } as const

describe('moving a unit between Games', () => {
  test('it lands in one home, with its history, and its links that still hold', async () => {
    const { a, b } = twoGames()
    b.units.create(MEDIATOR, { id: 'c9', kind: 'crawler', body: bodies.crawler('c9'), at: AT })
    await handOff(home(a), home(b), {
      leaseId: 'L1',
      unitId: 'm1',
      actor: PLAYER,
      to: toG2,
      at: AT,
    })
    await handOff(home(a), home(b), {
      leaseId: 'L2',
      unitId: 'p1',
      actor: PLAYER,
      to: toG2,
      at: AT,
    })

    expect(a.units.list(PLAYER)).toEqual([])
    expect(
      b.units
        .list(PLAYER)
        .map((u) => [u.id, u.ownerId])
        .sort()
    ).toEqual([
      ['c9', null],
      ['m1', PLAYER],
      ['p1', PLAYER],
    ])
    expect(b.units.history(PLAYER, 'p1')).toHaveLength(1)
    // The mech went first, so its pairing was dropped then; both board the primary crawler here.
    expect(
      b.units
        .links(PLAYER)
        .map((l) => `${l.from.id}>${l.to.id}`)
        .sort()
    ).toEqual(['m1>c9', 'p1>c9'])
  })

  test('a leaving unit refuses writes, and a refused accept puts it back', async () => {
    const { a } = twoGames()
    const elsewhere = table('g3').room
    elsewhere.roster.forgetMember(PLAYER)
    await expect(
      handOff(home(a), home(elsewhere), {
        leaseId: 'L1',
        unitId: 'p1',
        actor: PLAYER,
        to: { kind: 'game', gameId: 'g3' },
        at: AT,
      })
    ).rejects.toThrow('Not a member of this Game')
    expect(a.units.submit(PLAYER, [op('p1', { currentHP: 1 }, { baseSeq: 1 })]).ok).toBe(true)
    // A lease refused for good cannot be accepted late.
    expect(() => elsewhere.transit.accept({ leaseId: 'L1' } as UnitParcel, PLAYER, AT)).toThrow(
      'called off'
    )
  })

  test('only its holder moves it, and only to their own Training Bay', () => {
    const { a } = twoGames()
    const args = { leaseId: 'L1', unitId: 'p1', at: AT }
    expect(() => a.transit.offer({ ...args, actor: ORGANIZER, to: toG2 })).toThrow(
      "another player's"
    )
    expect(() =>
      a.transit.offer({ ...args, actor: PLAYER, to: { kind: 'account', userId: STRANGER } })
    ).toThrow('your own Training Bay')
    a.transit.offer({ ...args, actor: PLAYER, to: { kind: 'account', userId: PLAYER } })
    expect(() => a.units.submit(PLAYER, [op('p1', { currentHP: 1 }, { baseSeq: 1 })])).toThrow(
      'on its way'
    )
  })

  test('a crawler moves only between the Game and its table runner’s Training Bay', () => {
    const { a } = twoGames()
    a.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    const args = { leaseId: 'L1', unitId: 'c1', at: AT }
    expect(() =>
      a.transit.offer({ ...args, actor: PLAYER, to: { kind: 'account', userId: PLAYER } })
    ).toThrow('Only the Mediator')
    expect(() => a.transit.offer({ ...args, actor: MEDIATOR, to: toG2 })).toThrow(
      'move it out first'
    )
    const parcel = a.transit.offer({
      ...args,
      actor: MEDIATOR,
      to: { kind: 'account', userId: MEDIATOR },
    })
    a.transit.release(parcel.leaseId)
    expect(a.roster.read(PLAYER)?.crawlerName).toBeNull()
  })

  test('a handoff cut off after the accept settles to the target', async () => {
    const { a, b } = twoGames()
    const parcel = a.transit.offer({ leaseId: 'L1', unitId: 'p1', actor: PLAYER, to: toG2, at: AT })
    b.transit.accept(parcel, PLAYER, AT)
    b.transit.accept(parcel, PLAYER, AT)
    expect(a.transit.staleOffers(AT + 1).map((o) => o.leaseId)).toEqual(['L1'])
    expect(await settleLease(home(a), home(b), 'L1', AT + 1)).toBe('released')
    expect(a.units.list(PLAYER).map((u) => u.id)).toEqual(['m1'])
    expect(b.units.list(PLAYER).map((u) => u.id)).toEqual(['p1'])
  })

  test('a handoff cut off before the accept settles back to the source', async () => {
    const { a, b } = twoGames()
    const parcel = a.transit.offer({ leaseId: 'L1', unitId: 'p1', actor: PLAYER, to: toG2, at: AT })
    expect(await settleLease(home(a), home(b), 'L1', AT + 1)).toBe('cancelled')
    expect(() => b.transit.accept(parcel, PLAYER, AT + 2)).toThrow('called off')
    expect(a.units.list(PLAYER).find((u) => u.id === 'p1')?.leaseId).toBeNull()
  })

  test('a pilot from a Training Bay keeps its seat, aboard only a free mech of theirs here', () => {
    const { b } = twoGames()
    b.units.create(PLAYER, { id: 'm2', kind: 'mech', body: bodies.mech('m2'), at: AT })
    const parcel: UnitParcel = {
      leaseId: 'L9',
      from: { kind: 'account', userId: PLAYER },
      unit: {
        id: 'p7',
        kind: 'pilot',
        ownerId: PLAYER,
        body: bodies.pilot('p7'),
        headSeq: 0,
        fieldSeqs: {},
        publicRead: false,
      },
      ops: [],
      links: [],
      seat: {
        mount: { kind: 'boarded', mechId: 'm2' },
        range: 'Far',
        activeEffects: ['x'],
        ejected: false,
      },
    }
    expect(() =>
      b.transit.accept({ ...parcel, unit: { ...parcel.unit, ownerId: STRANGER } }, PLAYER, AT)
    ).toThrow('your own build')
    b.transit.accept(parcel, PLAYER, AT)
    expect(b.play.seat('p7')).toMatchObject({
      mount: { kind: 'boarded', mechId: 'm2' },
      range: 'Far',
    })
  })
})
