import { describe, expect, test } from 'bun:test'
import { ServerMessageSchema } from '../../protocol'
import { appliedMessages, batchAnswer, gameSnapshot, readClientMessage } from '../feed'
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
    expect(snapshot.records).toMatchObject({ opposition: [], salvageArea: [], boundaries: [] })
  })

  test('the table’s state rides as records, each read for its reader, never naming who', () => {
    const { room } = wired()
    room.scene.setConditions(MEDIATOR, ['freezing'], AT)
    room.scene.setSalvageArea(MEDIATOR, { name: 'Camp', techLevel: 2, supply: 3 }, AT)
    room.ledger.setFaction(
      MEDIATOR,
      { id: 'f1', name: 'Union', standing: 'neutral', deal: false },
      AT
    )
    room.safety.addBoundary(PLAYER, 'offCamera', 'Spiders', AT)
    room.safety.showStop(PLAYER, AT + 1)
    const mine = ServerMessageSchema.parse(gameSnapshot(room, PLAYER, 'g1'))
    expect(mine).toMatchObject({
      records: {
        scene: [{ appId: 'scene', body: { conditions: ['freezing'], hours: 0 }, updatedAt: AT }],
        salvageArea: [{ body: { name: 'Camp', techLevel: 2, supply: 3 } }],
        ledger: [{ appId: 'ledger', body: { factions: [{ id: 'f1' }], incomeCollected: false } }],
        boundaries: [{ body: { kind: 'offCamera', text: 'Spiders', mine: true }, updatedAt: AT }],
        safety: [{ body: { stop: { shownAt: AT + 1, mine: true } }, updatedAt: AT + 1 }],
      },
    })
    const theirs = gameSnapshot(room, MEDIATOR, 'g1')
    expect(theirs).toMatchObject({
      records: {
        boundaries: [{ body: { mine: false, mayRemove: true } }],
        safety: [{ body: { stop: { mine: false }, mayLift: true } }],
      },
    })
    if (theirs.type !== 'snapshot') throw new Error(theirs.type)
    const { boundaries, safety } = theirs.records
    expect(JSON.stringify({ boundaries, safety })).not.toContain(PLAYER)
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
    expect(batchAnswer(['a'], { ok: true, applied: [{ id: 'a', seq: 1 }] })).toEqual({
      type: 'ack',
      opIds: ['a'],
    })
    expect(
      batchAnswer(['a'], { ok: false, opId: 'a', reason: 'conflict', fields: ['motto', 'name'] })
    ).toEqual({ type: 'declined', opIds: ['a'], reason: 'Changed elsewhere first: motto, name' })
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
