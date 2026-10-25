import { describe, expect, test } from 'bun:test'
import { ServerMessageSchema } from '../../protocol'
import { appliedMessages, gameSnapshot } from '../feed'
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
    expect(snapshot.records).toEqual({ opposition: [] })
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
