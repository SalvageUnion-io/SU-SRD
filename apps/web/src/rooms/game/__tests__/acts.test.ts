import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import {
  AT,
  bodies,
  emptyRoom,
  MEDIATOR,
  ORGANIZER,
  op,
  PLAYER,
  profile,
  STRANGER,
  table,
} from './harness'

/** A roll as Play appends it. */
function roll(description: string) {
  return { entityType: 'game', field: 'roll', after: { description }, source: 'play', ts: AT }
}

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
    expect(runAct(c, 'downtime.begin', undefined as never)).toEqual({
      ok: false,
      refusal: 'Not a member of this Game',
    })
    expect(() =>
      runAct(c, 'seats.setRange' as never, { pilotId: 'nope', range: 'Orbit' } as never)
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

describe('every act reaches its part of the room', () => {
  test('a session at the table, act by act', () => {
    const { room } = table()
    const as = (actor: string) => ({ room, actor, gameId: 'g1', at: AT })
    const ok = <T>(answer: { ok: true; value: T } | { ok: false; refusal: string }): T => {
      if (!answer.ok) throw new Error(answer.refusal)
      return answer.value
    }
    const org = as(ORGANIZER)
    const med = as(MEDIATOR)
    const me = as(PLAYER)

    expect(ok(runAct(org, 'members', undefined as never))).toHaveLength(3)
    ok(runAct(me, 'updateProfile', { profile: profile('Renamed') }))
    const code = ok(runAct(org, 'resetInvite', undefined as never)).code
    expect(ok(runAct(as(STRANGER), 'invitePreview', { code }))?.gameName).toBe('Tenacity')

    ok(runAct(me, 'createUnit', { id: 'p1', kind: 'pilot', body: bodies.pilot('p1') }))
    ok(runAct(me, 'createUnit', { id: 'm1', kind: 'mech', body: bodies.mech('m1') }))
    ok(runAct(med, 'createUnit', { id: 'c1', kind: 'crawler', body: bodies.crawler('c1') }))
    ok(runAct(med, 'setPrimaryCrawler', { crawlerId: 'c1' }))
    const link = {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
    } as const
    ok(runAct(me, 'drawLink', { link }))
    expect(ok(runAct(me, 'links', undefined as never)).length).toBeGreaterThan(0)
    ok(runAct(me, 'removeLink', { link }))
    expect(ok(runAct(me, 'units', undefined as never))).toHaveLength(3)

    const pr1 = ok(runAct(med, 'ops.propose', { entityId: 'p1', field: 'motto', after: 'Onward' }))
    expect(ok(runAct(me, 'ops.pending', undefined as never))).toHaveLength(1)
    expect(ok(runAct(med, 'ops.sent', undefined as never))).toHaveLength(1)
    ok(runAct(me, 'ops.accept', { opId: pr1 }))
    const pr2 = ok(runAct(med, 'ops.propose', { entityId: 'p1', field: 'motto', after: 'Back' }))
    ok(runAct(me, 'ops.decline', { opId: pr2 }))
    expect(ok(runAct(me, 'changeLog.forEntity', { entityId: 'p1' }))).toContainEqual(
      expect.objectContaining({ field: 'motto', after: 'Onward', state: 'applied' })
    )

    ok(runAct(me, 'seats.board', { pilotId: 'p1', mechId: 'm1' }))
    ok(
      runAct(me, 'seats.setResolving', {
        pilotId: 'p1',
        resolving: { ref: 'x', name: 'X', activated: true, applied: false },
      })
    )
    ok(runAct(me, 'seats.clearResolving', { pilotId: 'p1' }))
    ok(runAct(me, 'seats.toggleEffect', { pilotId: 'p1', ref: 'smoke' }))
    ok(runAct(me, 'seats.setRange', { pilotId: 'p1', range: 'Long' }))
    ok(runAct(me, 'seats.eject', { pilotId: 'p1' }))
    ok(runAct(me, 'seats.dismount', { pilotId: 'p1' }))
    expect(ok(runAct(me, 'seats.forGame', undefined as never))).toHaveLength(1)

    ok(runAct(med, 'downtime.begin', undefined as never))
    ok(runAct(me, 'downtime.markStepDone', { done: true }))
    ok(runAct(med, 'downtime.advance', undefined as never))
    ok(runAct(med, 'downtime.setStep', { stepIndex: 0 }))
    runAct(med, 'downtime.spendUpkeep', undefined as never)
    expect(ok(runAct(me, 'downtime.state', undefined as never))?.running).toBe(true)
    ok(runAct(med, 'downtime.end', undefined as never))

    ok(runAct(me, 'changeLog.appendChangeLog', { entries: [roll('Ram: 14')] }))
    expect(runAct(me, 'changeLog.broadcast', { message: 'Hold' })).toMatchObject({ ok: false })
    ok(runAct(med, 'changeLog.broadcast', { message: '  Hold the line ' }))
    expect(ok(runAct(me, 'changeLog.rolls', undefined as never))).toMatchObject([
      { description: 'Ram: 14', actorName: 'Renamed' },
    ])
    expect(ok(runAct(me, 'changeLog.alerts', undefined as never))).toMatchObject([
      { message: 'Hold the line', actorId: MEDIATOR },
    ])

    const npc = ok(runAct(med, 'mediator.addNpc', { body: { name: 'Raider' } }))
    ok(runAct(med, 'mediator.updateNpc', { npcId: npc, patch: { name: 'Raider Boss' } }))
    expect(ok(runAct(med, 'mediator.npcs', undefined as never))).toHaveLength(1)
    ok(runAct(med, 'mediator.removeNpc', { npcId: npc }))
    expect(ok(runAct(med, 'mediator.running', undefined as never))).toBeNull()
    expect(() => runAct(med, 'mediator.runEncounter', { encounter: {}, clear: false })).toThrow()
    ok(runAct(med, 'mediator.endEncounter', undefined as never))

    ok(runAct(med, 'assign', { unitId: 'm1', userId: MEDIATOR }))
    ok(runAct(med, 'removeUnit', { unitId: 'm1' }))
    ok(runAct(med, 'unassign', { unitId: 'p1' }))
    ok(runAct(org, 'setMediator', { userId: MEDIATOR, mediator: false }))
  })
})
