import { describe, expect, test } from 'bun:test'
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
})
