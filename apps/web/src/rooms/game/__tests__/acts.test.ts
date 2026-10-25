import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import { AT, bodies, emptyRoom, MEDIATOR, op, PLAYER, profile, STRANGER, table } from './harness'

describe('acts by name', () => {
  test('the room names the Game and the time, not the caller', () => {
    const { room } = emptyRoom()
    const at = AT + 7
    const made = runAct({ room, actor: PLAYER, gameId: 'g-own', at }, 'create', {
      name: 'Tenacity',
      profile: profile('Player'),
      // A caller's own gameId or time is not part of the act.
      ...({ gameId: 'g-other', at: 0 } as object),
    })
    expect(made).toEqual({ ok: true, value: undefined })
    expect(room.roster.read(PLAYER)).toMatchObject({ gameId: 'g-own' })
  })

  test('a refusal is an answer; a defect throws', () => {
    const { room } = table()
    const c = { room, actor: STRANGER, gameId: 'g1', at: AT }
    expect(runAct(c, 'beginDowntime', undefined as never)).toEqual({
      ok: false,
      refusal: 'Not a member of this Game',
    })
    expect(() =>
      runAct(c, 'setRange' as never, { pilotId: 'nope', range: 'Orbit' } as never)
    ).toThrow()
    expect(() => runAct(c, 'toString' as never, undefined as never)).toThrow('No Game act named')
  })

  test('the bot sees the actor’s own units and the primary crawler, with whose they are', () => {
    const { room } = table()
    room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    room.units.create(MEDIATOR, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT })
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    const c = { room, actor: PLAYER, gameId: 'g1', at: AT }
    const mine = runAct(c, 'unitsFor', undefined as never)
    expect(mine.ok && mine.value.map((u) => u.id).sort()).toEqual(['c1', 'p1'])
    expect(runAct(c, 'unit', { unitId: 'p2' })).toMatchObject({
      ok: true,
      value: { id: 'p2', kind: 'pilot', ownerName: 'Med' },
    })
    expect(runAct({ ...c, actor: STRANGER }, 'unit', { unitId: 'p1' })).toEqual({
      ok: true,
      value: null,
    })
  })
})

describe('server-only op sources', () => {
  test('a client cannot forge a proposal, or apply an op that is not one', () => {
    const { room } = table()
    room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
    const forged = op('p1', { currentHP: 1 }, { id: 'forged', source: 'mediator-proposal' })
    expect(() => room.units.submit(PLAYER, [forged])).toThrow('only come from the Game')
    expect(() => room.units.submit(PLAYER, [{ ...forged, source: 'ownership' }])).toThrow(
      'only come from the Game'
    )
    expect(room.proposals.sent(MEDIATOR)).toEqual([])

    room.units.submit(PLAYER, [op('p1', { currentHP: 2 }, { id: 'plain' })])
    expect(() => room.proposals.applyProposal(PLAYER, 'plain', AT)).toThrow('no longer exists')
  })
})
