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

    ok(runAct(med, 'propose', { id: 'pr1', unitId: 'p1', field: 'motto', value: 'Onward' }))
    expect(ok(runAct(me, 'pendingProposals', undefined as never))).toHaveLength(1)
    expect(ok(runAct(med, 'sentProposals', undefined as never))).toHaveLength(1)
    ok(runAct(me, 'applyProposal', { proposalId: 'pr1' }))
    ok(runAct(med, 'propose', { id: 'pr2', unitId: 'p1', field: 'motto', value: 'Back' }))
    ok(runAct(me, 'declineProposal', { proposalId: 'pr2' }))
    expect(ok(runAct(me, 'history', { unitId: 'p1' })).length).toBeGreaterThan(0)

    ok(runAct(me, 'board', { pilotId: 'p1', mechId: 'm1' }))
    ok(
      runAct(me, 'setResolving', {
        pilotId: 'p1',
        resolving: { ref: 'x', name: 'X', activated: true, applied: false },
      })
    )
    ok(runAct(me, 'clearResolving', { pilotId: 'p1' }))
    ok(runAct(me, 'toggleEffect', { pilotId: 'p1', ref: 'smoke' }))
    ok(runAct(me, 'setRange', { pilotId: 'p1', range: 'Long' }))
    ok(runAct(me, 'eject', { pilotId: 'p1' }))
    ok(runAct(me, 'dismount', { pilotId: 'p1' }))
    expect(ok(runAct(me, 'seats', undefined as never))).toHaveLength(1)

    ok(runAct(med, 'beginDowntime', undefined as never))
    ok(runAct(me, 'markStepDone', { done: true }))
    ok(runAct(med, 'advanceDowntime', undefined as never))
    ok(runAct(med, 'setDowntimeStep', { stepIndex: 0 }))
    runAct(med, 'spendUpkeep', undefined as never)
    expect(ok(runAct(me, 'downtime', undefined as never))?.running).toBe(true)
    ok(runAct(med, 'endDowntime', undefined as never))

    const npc = ok(runAct(med, 'addNpc', { body: { name: 'Raider' } }))
    ok(runAct(med, 'updateNpc', { npcId: npc, patch: { name: 'Raider Boss' } }))
    expect(ok(runAct(med, 'tray', undefined as never))).toHaveLength(1)
    ok(runAct(med, 'removeNpc', { npcId: npc }))
    expect(ok(runAct(med, 'runningEncounter', undefined as never))).toBeNull()
    expect(() => runAct(med, 'runEncounter', { encounter: {}, clear: false })).toThrow()
    ok(runAct(med, 'endEncounter', undefined as never))

    ok(runAct(med, 'assign', { unitId: 'm1', userId: MEDIATOR }))
    ok(runAct(med, 'removeUnit', { unitId: 'm1' }))
    ok(runAct(med, 'unassign', { unitId: 'p1' }))
    ok(runAct(org, 'setMediator', { userId: MEDIATOR, mediator: false }))
  })
})
