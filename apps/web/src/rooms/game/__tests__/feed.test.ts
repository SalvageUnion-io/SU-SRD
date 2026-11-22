import { describe, expect, test } from 'bun:test'
import { ServerMessageSchema } from '../../protocol'
import { runAct } from '../acts'
import {
  appliedMessages,
  batchAnswer,
  CHANGED_FIRST,
  CHANGED_FIRST_BY_YOU,
  gameSnapshot,
  readClientMessage,
} from '../feed'
import { readerOf } from '../readers'
import { AT, bodies, MEDIATOR, op, PLAYER, STRANGER, table } from './harness'

/** A Game with a pilot boarded in a mech and one NPC on the tray. */
function wired() {
  const made = table('g1')
  const { room } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  room.units.drawLink(PLAYER, {
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'm1' },
    to: { type: 'pilot', id: 'p1' },
  })
  room.opposition.addNpc(MEDIATOR, { name: 'Raider' }, AT)
  return made
}

describe('what a Game room tells a socket', () => {
  test('a member’s snapshot holds every unit in this Game, and every link with its key', () => {
    const { room } = wired()
    const snapshot = ServerMessageSchema.parse(gameSnapshot(room, PLAYER, 'g1'))
    if (snapshot.type !== 'snapshot') throw new Error(snapshot.type)
    expect(snapshot.units.map((u) => [u.appId, u.gameId, u.owner])).toEqual([
      ['m1', 'g1', PLAYER],
      ['p1', 'g1', PLAYER],
    ])
    expect(snapshot.links).toEqual([
      expect.objectContaining({ id: 'mech-to-pilot:m1:p1:', from: { type: 'mech', id: 'm1' } }),
    ])
    expect(Date.parse(snapshot.links[0]?.createdAt ?? '')).toBeGreaterThan(0)
    expect(snapshot.records).toMatchObject({ opposition: [], salvageArea: [] })
    expect(snapshot.records.game).toEqual([
      { appId: 'game', body: { primaryCrawlerId: null }, updatedAt: 0 },
    ])
  })

  test('an NPC in a Game is its Mediator’s: the room serves a player nothing of it, by snapshot, by address or by its log (r3 A3)', () => {
    const { room, gameId } = wired()
    room.units.create(MEDIATOR, { id: 'n1', kind: 'npc', body: bodies.npc('n1'), at: AT })
    room.units.create(PLAYER, { id: 'n2', kind: 'npc', body: bodies.npc('n2'), at: AT })
    const ids = (actor: string) => {
      const snapshot = gameSnapshot(room, actor, 'g1')
      if (snapshot.type !== 'snapshot') throw new Error(snapshot.type)
      return snapshot.units.map((u) => u.appId).sort()
    }
    expect(ids(MEDIATOR)).toEqual(['m1', 'n1', 'n2', 'p1'])
    // A player reads their own NPC, never the Mediator's.
    expect(ids(PLAYER)).toEqual(['m1', 'n2', 'p1'])
    expect(JSON.stringify(gameSnapshot(room, PLAYER, 'g1'))).not.toContain('n1')
    const opened = (actor: string) =>
      runAct({ room, actor, gameId, at: AT }, 'unit', { unitId: 'n1' })
    expect(opened(PLAYER)).toEqual({ ok: true, value: null })
    expect(opened(MEDIATOR)).toMatchObject({ ok: true, value: { id: 'n1' } })
    runAct({ room, actor: MEDIATOR, gameId, at: AT }, 'submit', {
      ops: [op('n1', { currentHP: 1 })],
    })
    expect(room.units.history(PLAYER, 'n1')).toEqual([])
    expect(room.units.history(MEDIATOR, 'n1').length).toBeGreaterThan(0)
    expect(readerOf(room.store, STRANGER)(room.store.requireUnit('p1'))).toBe(false)
    // One that crews a crawler is on that crawler's sheet, which the table reads.
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    room.store.putLink({
      type: 'npc-to-crawler',
      from: { type: 'npc', id: 'n1' },
      to: { type: 'crawler', id: 'c1' },
      slot: { kind: 'type' },
    })
    expect(ids(PLAYER)).toEqual(['c1', 'm1', 'n1', 'n2', 'p1'])
    const snapshot = gameSnapshot(room, PLAYER, 'g1')
    expect(snapshot.type === 'snapshot' && snapshot.links.some((l) => l.from.id === 'n1')).toBe(
      true
    )
  })

  test('the primary crawler rides as the `game` record', () => {
    const { room } = wired()
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    const snapshot = gameSnapshot(room, PLAYER, 'g1')
    if (snapshot.type !== 'snapshot') throw new Error(snapshot.type)
    expect(snapshot.records.game?.[0]?.body).toEqual({ primaryCrawlerId: 'c1' })
  })

  test('the table’s state rides as records, each read for its reader, never naming who', () => {
    const { room } = wired()
    room.scene.setConditions(MEDIATOR, ['freezing'], AT)
    room.scene.setSalvageArea(MEDIATOR, { name: 'Camp', techLevel: 2, supply: 3 }, AT)
    room.safety.showStop(PLAYER, AT + 1)
    const mine = ServerMessageSchema.parse(gameSnapshot(room, PLAYER, 'g1'))
    expect(mine).toMatchObject({
      records: {
        scene: [{ appId: 'scene', body: { conditions: ['freezing'], hours: 0 }, updatedAt: AT }],
        salvageArea: [{ body: { name: 'Camp', techLevel: 2, supply: 3 } }],
        safety: [{ body: { stop: { shownAt: AT + 1, mine: true } }, updatedAt: AT + 1 }],
      },
    })
    const theirs = gameSnapshot(room, MEDIATOR, 'g1')
    expect(theirs).toMatchObject({
      records: {
        safety: [{ body: { stop: { mine: false }, mayLift: true } }],
      },
    })
    if (theirs.type !== 'snapshot') throw new Error(theirs.type)
    expect(JSON.stringify(theirs.records.safety)).not.toContain(PLAYER)
  })

  test('the table in play rides as records too: roster, seats, Downtime, proposals and feed', () => {
    const { room } = wired()
    room.play.board(PLAYER, 'p1', 'm1', AT)
    room.play.beginDowntime(MEDIATOR, AT)
    room.proposals.propose(MEDIATOR, {
      id: 'pr1',
      unitId: 'p1',
      field: 'motto',
      value: 'Go',
      at: AT,
    })
    room.log.broadcast(MEDIATOR, 'Incoming', AT)
    const mine = ServerMessageSchema.parse(gameSnapshot(room, PLAYER, 'g1'))
    expect(mine).toMatchObject({
      records: {
        members: expect.arrayContaining([
          { appId: PLAYER, body: expect.objectContaining({ userId: PLAYER }), updatedAt: AT + 1 },
        ]),
        seats: [{ appId: 'p1', body: { mount: { kind: 'boarded', mechId: 'm1' } }, updatedAt: AT }],
        downtime: [
          { appId: 'downtime', body: { running: true, stepIndex: 0, doneSteps: { p1: [] } } },
        ],
        proposals: [{ appId: 'pr1', body: { entityId: 'p1', after: 'Go' } }],
        sentProposals: [],
        rolls: [],
        alerts: [{ body: { message: 'Incoming', actorId: MEDIATOR } }],
        crew: [
          {
            appId: 'crew',
            body: {
              pilots: [
                { _id: 'p1', ownerId: PLAYER, ownerName: 'Player', boarded: true, mechId: 'm1' },
              ],
              mechs: [{ _id: 'm1', ownerId: PLAYER }],
            },
          },
        ],
      },
    })
    expect(gameSnapshot(room, MEDIATOR, 'g1')).toMatchObject({
      records: { proposals: [], sentProposals: [{ appId: 'pr1', body: { mine: true } }] },
    })
  })

  test('only a Mediator’s holds the Opposition; a stranger’s holds nothing', () => {
    const { room } = wired()
    const mediator = gameSnapshot(room, MEDIATOR, 'g1')
    expect(mediator).toMatchObject({
      records: { opposition: [{ body: { name: 'Raider' }, updatedAt: AT }] },
    })
    expect(gameSnapshot(room, STRANGER, 'g1')).toEqual({
      type: 'snapshot',
      units: [],
      records: {},
      links: [],
    })
  })

  test('an applied op is one message: the op and its unit at the new head', () => {
    const { room } = wired()
    const sent = op('p1', { motto: 'Keep moving' })
    room.units.submit(PLAYER, [sent])
    const [applied, ...rest] = appliedMessages(room.store, [sent.id, 'op-unknown'], 'g1')
    expect(rest).toEqual([])
    expect(ServerMessageSchema.parse(applied)).toMatchObject({
      type: 'applied',
      op: { id: sent.id, seq: 1, state: 'applied' },
      unit: { appId: 'p1', headSeq: 1, body: { motto: 'Keep moving' } },
    })
  })
})

describe('what the sender of a batch hears', () => {
  test('an ack, or the reason it was declined', () => {
    expect(
      batchAnswer(['a', 'b'], {
        ok: true,
        applied: [
          { id: 'a', seq: 1 },
          { id: 'b', seq: 2 },
        ],
        fresh: ['b'],
      })
    ).toEqual({ type: 'ack', opIds: ['a', 'b'], fresh: ['b'] })
    expect(
      batchAnswer(['a'], { ok: false, opId: 'a', reason: 'conflict', fields: ['motto', 'name'] })
    ).toEqual({ type: 'declined', opIds: ['a'], reason: CHANGED_FIRST })
    // Their own change from another screen is not "someone else's".
    expect(
      batchAnswer(['a'], { ok: false, opId: 'a', reason: 'conflict', fields: ['name'], own: true })
    ).toEqual({ type: 'declined', opIds: ['a'], reason: CHANGED_FIRST_BY_YOU })
    expect(CHANGED_FIRST_BY_YOU).not.toMatch(/Someone|motto|current[A-Z]/)
    // Plain words, and no stored field's name (LG-03).
    expect(CHANGED_FIRST).not.toMatch(/motto|name|current[A-Z]/)
    expect(batchAnswer(['a'], { ok: false, opId: 'a', reason: 'invalid', message: 'No' })).toEqual({
      type: 'declined',
      opIds: ['a'],
      reason: 'No',
    })
  })
})

describe('what a Game room reads from a socket', () => {
  test('an ops batch or an act, and nothing else', () => {
    const ops = [
      {
        id: 'op-1',
        unitId: 'u',
        baseSeq: 0,
        at: AT,
        kind: 'manual' as const,
        source: 's',
        patch: {},
      },
    ]
    expect(readClientMessage(JSON.stringify({ type: 'ops', ops }))).toEqual({ type: 'ops', ops })
    const act = { type: 'act' as const, id: 'a-1', name: 'scenes.passHour' }
    expect(readClientMessage(JSON.stringify(act))).toEqual(act)
    expect(readClientMessage('not json')).toBeNull()
    expect(readClientMessage(JSON.stringify({ type: 'ops', ops: [] }))).toBeNull()
  })
})
