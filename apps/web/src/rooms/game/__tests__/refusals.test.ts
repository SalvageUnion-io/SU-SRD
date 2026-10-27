import { describe, expect, test } from 'bun:test'
import { accountSocketPath } from '../../routes'
import { unitName } from '../units'
import { AT, bodies, MEDIATOR, ORGANIZER, PLAYER, table } from './harness'

/** The room's refusals a player can reach, each in the words they read. */

function crewed() {
  const made = table()
  const { room } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(PLAYER, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT })
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
  return made
}

describe('what the room refuses', () => {
  test('a sheet with no name is called nothing', () => {
    expect(unitName({ kind: 'pilot', body: { callsign: ' ', name: '' } })).toBeNull()
    expect(unitName({ kind: 'mech', body: { name: ' Rig ' } })).toBe('Rig')
  })

  test('holding, unassigning and the primary crawler answer to their roles', () => {
    const { room } = crewed()
    expect(() => room.units.unassign(ORGANIZER, 'p1', AT)).toThrow('Only its holder')
    expect(() => room.units.setPrimaryCrawler(MEDIATOR, 'p1')).toThrow('not in this Game')
    expect(() =>
      room.proposals.propose(MEDIATOR, {
        id: 'pr-c',
        unitId: 'c1',
        field: 'name',
        value: 'x',
        at: AT,
      })
    ).toThrow('Only a Pilot or a Mech')
  })

  test('a player takes a free sheet for themselves, and only that', () => {
    const { room } = crewed()
    room.units.create(MEDIATOR, { id: 'p3', kind: 'pilot', body: bodies.pilot('p3'), at: AT })
    expect(() => room.units.assign(PLAYER, 'p3', AT)).toThrow('A crewmate already holds that')
    expect(() => room.units.assign(PLAYER, 'p1', AT, MEDIATOR)).toThrow('Only the Mediator')
  })

  test('a proposal that no longer fits the sheet is refused when applied', () => {
    const { room } = crewed()
    room.proposals.propose(MEDIATOR, {
      id: 'pr1',
      unitId: 'p1',
      field: 'invalid',
      value: 1,
      at: AT,
    })
    expect(() => room.proposals.applyProposal(PLAYER, 'pr1', AT)).toThrow('does not fit this sheet')
  })

  test('a seat answers for its pilot, and a Mech takes one pilot', () => {
    const { room } = crewed()
    expect(() => room.play.setRange(PLAYER, 'm1', 'Long', AT)).toThrow('That Pilot is not')
    room.play.board(PLAYER, 'p1', 'm1', AT)
    expect(() => room.play.board(PLAYER, 'p2', 'm1', AT)).toThrow('already aboard')
    room.play.dismount(PLAYER, 'p1', AT)
    room.units.submit(PLAYER, [
      {
        id: 'wreck',
        unitId: 'm1',
        baseSeq: null,
        at: AT,
        kind: 'manual',
        source: 'live-sheet',
        patch: { destroyed: true },
      },
    ])
    expect(() => room.play.board(PLAYER, 'p1', 'm1', AT)).toThrow('destroyed')
  })

  test('a link whose ends do not fit its type is a defect', () => {
    const { room } = crewed()
    expect(() =>
      room.units.drawLink(PLAYER, {
        type: 'mech-to-pilot',
        from: { type: 'pilot', id: 'p1' },
        to: { type: 'mech', id: 'm1' },
      })
    ).toThrow('cannot join')
    expect(() =>
      room.units.drawLink(MEDIATOR, {
        type: 'npc-to-crawler',
        from: { type: 'npc', id: 'n1' },
        to: { type: 'crawler', id: 'c1' },
      })
    ).toThrow('crew slot')
  })

  test('the account socket has its path', () => {
    expect(accountSocketPath()).toMatch(/\/account\/socket$/)
  })
})
