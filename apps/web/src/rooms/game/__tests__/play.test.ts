import { describe, expect, test } from 'bun:test'
import { downtimeStepCount, isUpkeepStep } from 'game-domain/rules/downtime'
import { downtimeStepOpId } from '../play'
import { AT, bodies, MEDIATOR, ORGANIZER, op, PLAYER, table } from './harness'

function seated() {
  const made = table()
  const { room } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  room.units.create(ORGANIZER, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT })
  return made
}

describe('seats', () => {
  test('a pilot with no seat sits down on foot at Close range', () => {
    const { room } = seated()
    room.play.setRange(PLAYER, 'p1', 'Long', AT)
    expect(room.play.seats(ORGANIZER)).toEqual([
      {
        pilotId: 'p1',
        mount: { kind: 'foot' },
        range: 'Long',
        activeEffects: [],
        resolving: null,
        ejected: false,
        updatedAt: AT,
      },
    ])
  })

  test('boarding needs the mech, free and intact; changing mount drops the resolve', () => {
    const { room } = seated()
    expect(() => room.play.board(ORGANIZER, 'p1', 'm1', AT)).toThrow("another player's")
    room.play.board(PLAYER, 'p1', 'm1', AT)
    room.play.setResolving(
      PLAYER,
      'p1',
      { ref: 'x', name: 'X', activated: true, applied: false },
      AT
    )
    expect(() => room.play.board(ORGANIZER, 'p2', 'm1', AT)).toThrow("another player's")
    room.play.dismount(PLAYER, 'p1', AT)
    expect(room.play.seat('p1')).toMatchObject({ mount: { kind: 'foot' }, resolving: null })
    room.units.submit(PLAYER, [op('m1', { destroyed: true })])
    expect(() => room.play.board(PLAYER, 'p1', 'm1', AT)).toThrow('That Mech is destroyed')
    expect(() => room.play.board(PLAYER, 'p1', 'nope', AT)).toThrow('not in this Game')
  })

  test('eject leaves the pilot on foot and marked, until they next board', () => {
    const { room } = seated()
    room.play.board(PLAYER, 'p1', 'm1', AT)
    room.play.eject(PLAYER, 'p1', AT)
    expect(room.play.seat('p1')).toMatchObject({ mount: { kind: 'foot' }, ejected: true })
    room.play.board(PLAYER, 'p1', 'm1', AT)
    expect(room.play.seat('p1')?.ejected).toBe(false)
  })

  test('effects toggle; a bad range is a defect', () => {
    const { room } = seated()
    room.play.toggleEffect(PLAYER, 'p1', 'smoke', AT)
    room.play.toggleEffect(PLAYER, 'p1', 'flare', AT)
    room.play.toggleEffect(PLAYER, 'p1', 'smoke', AT)
    expect(room.play.seat('p1')?.activeEffects).toEqual(['flare'])
    expect(() => room.play.setRange(PLAYER, 'p1', 'Orbit', AT)).toThrow('Not one of RANGE_BANDS')
    room.play.clearResolving(PLAYER, 'p1', AT)
  })
})

describe('Downtime', () => {
  test('the Mediator runs it; anyone marks themselves done; a move clears who is done', () => {
    const { room } = seated()
    expect(room.play.downtime(PLAYER)?.running).toBe(false)
    expect(() => room.play.beginDowntime(PLAYER, AT)).toThrow('Only the Mediator')
    room.play.beginDowntime(MEDIATOR, AT)
    const runId = room.play.downtime(PLAYER)?.runId
    room.play.beginDowntime(MEDIATOR, AT + 1)
    expect(room.play.downtime(PLAYER)?.runId).toBe(runId)

    room.play.markStepDone(PLAYER, true)
    room.play.markStepDone(PLAYER, true)
    expect(room.play.downtime(PLAYER)?.completedBy).toEqual([PLAYER])
    room.play.advanceDowntime(MEDIATOR)
    expect(room.play.downtime(PLAYER)).toMatchObject({ stepIndex: 1, completedBy: [] })
    room.play.setDowntimeStep(MEDIATOR, 999)
    expect(room.play.downtime(PLAYER)?.stepIndex).toBe(downtimeStepCount() - 1)
    room.play.endDowntime(MEDIATOR)
    expect(() => room.play.markStepDone(PLAYER, true)).toThrow('Downtime is not running')
  })

  test('upkeep is paid once, in its own step', () => {
    const { room } = seated()
    room.play.beginDowntime(MEDIATOR, AT)
    const upkeep = Array.from({ length: downtimeStepCount() }, (_, i) => i).find(isUpkeepStep)
    if (upkeep === undefined) throw new Error('the guide has no upkeep step')
    if (upkeep !== 0) expect(() => room.play.spendUpkeep(MEDIATOR)).toThrow('Upkeep is paid in')
    room.play.setDowntimeStep(MEDIATOR, upkeep)
    expect(room.play.spendUpkeep(MEDIATOR)).toBe(true)
    expect(room.play.spendUpkeep(MEDIATOR)).toBe(false)
  })

  test('a step a pilot applies twice lands once', () => {
    const { room } = seated()
    room.play.beginDowntime(MEDIATOR, AT)
    const runId = room.play.downtime(PLAYER)?.runId ?? ''
    const step = op(
      'p1',
      { currentHP: 10 },
      { id: downtimeStepOpId(runId, 'p1', 0), source: 'downtime' }
    )
    room.units.submit(PLAYER, [step])
    room.units.submit(PLAYER, [{ ...step, patch: { currentHP: 99 } }])
    expect(room.units.list(PLAYER).find((u) => u.id === 'p1')?.body.currentHP).toBe(10)
  })
})
