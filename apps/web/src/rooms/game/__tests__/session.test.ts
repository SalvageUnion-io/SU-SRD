import { describe, expect, test } from 'bun:test'
import { runAct } from '../acts'
import { AT, MEDIATOR, ORGANIZER, PLAYER, STRANGER, table } from './harness'

describe('the group session', () => {
  test('the Mediator starts it once and ends it; every member reads it', () => {
    const { room } = table()
    expect(room.session.session(PLAYER)).toEqual({ live: false, startedAt: null })
    expect(room.session.start(MEDIATOR, AT)).toBe(true)
    // A second press while it runs starts nothing.
    expect(room.session.start(MEDIATOR, AT + 1)).toBe(false)
    expect(room.session.session(PLAYER)).toEqual({ live: true, startedAt: AT })
    expect(room.session.session(STRANGER)).toEqual({ live: false, startedAt: null })
    room.session.end(MEDIATOR)
    room.session.end(MEDIATOR)
    expect(room.session.session(PLAYER).live).toBe(false)
  })

  test('only the table runner starts or ends it', () => {
    const { room } = table()
    expect(() => room.session.start(PLAYER, AT)).toThrow()
    expect(() => room.session.start(ORGANIZER, AT)).toThrow()
    room.session.start(MEDIATOR, AT)
    expect(() => room.session.end(PLAYER)).toThrow()
    expect(room.session.session(PLAYER).live).toBe(true)
  })

  test('with nobody mediating, the Organiser runs it', () => {
    const { room } = table('g2', { mediator: false })
    expect(room.session.start(ORGANIZER, AT)).toBe(true)
    expect(room.session.session(PLAYER).live).toBe(true)
  })

  test('ending it marks the plan the table played, by the day the Mediator says (r8 B8)', () => {
    const { room, gameId } = table()
    const sessions = [
      { id: 's1', date: '2026-11-23', note: '' },
      { id: 's2', date: '2026-11-30', note: '' },
    ]
    room.plan.write(MEDIATOR, { schemaVersion: 1, notes: '', sessions }, AT)
    room.session.start(MEDIATOR, AT)
    const end = runAct({ room, actor: MEDIATOR, gameId, at: AT + 1 }, 'session.end', {
      day: '2026-11-23',
    })
    expect(end.ok).toBe(true)
    expect(room.plan.read(MEDIATOR).sessions.map((s) => s.played)).toEqual([
      '2026-11-23',
      undefined,
    ])
    expect(room.plan.sessionDays('2026-11-22')).toEqual(['2026-11-30'])
  })
})
