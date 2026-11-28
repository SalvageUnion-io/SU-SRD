import { expect, test } from 'bun:test'
import type { TableEvent } from '../../../rooms/game/events'
import { lastSession } from '../lastSession.model'

const e = (ts: number, over: Partial<TableEvent> = {}): TableEvent => ({
  _id: `e${ts}`,
  ts,
  kind: 'vitals',
  text: `line ${ts}`,
  actorId: 'u',
  ...over,
})

test('nothing played, no record: a member joining is not play', () => {
  expect(lastSession([])).toBeNull()
  expect(lastSession([e(1, { kind: 'join' }), e(2, { kind: 'role' })])).toBeNull()
})

// MD4-04: an encounter run before Start group session read "Rolls: 0".
test('play counts whether or not a session was started for it', () => {
  const record = lastSession([e(1, { kind: 'roll' }), e(2), e(5, { kind: 'roll' })])
  expect(record).toMatchObject({ startedAt: 1, endedAt: 5, rolls: 2, changes: 1 })
})

test('play before Start group session belongs to the session that follows', () => {
  const record = lastSession([
    e(1, { kind: 'session', session: 'start' }),
    e(2, { kind: 'session', session: 'end' }),
    e(3, { kind: 'roll' }),
    e(4),
    e(5, { kind: 'session', session: 'start' }),
    e(6, { kind: 'roll' }),
    e(9, { kind: 'session', session: 'end' }),
  ])
  expect(record).toMatchObject({ startedAt: 3, endedAt: 9, rolls: 2, changes: 1 })
  expect(record?.lines.map((l) => l.ts)).toEqual([6, 4, 3])
})

test('a session with nothing in it does not replace a real one', () => {
  const real = [
    e(1, { kind: 'session', session: 'start' }),
    e(2, { kind: 'roll' }),
    e(3, { kind: 'session', session: 'end' }),
  ]
  const ended = lastSession([
    ...real,
    e(10, { kind: 'session', session: 'start' }),
    e(11, { kind: 'session', session: 'end' }),
  ])
  expect(ended).toMatchObject({ startedAt: 1, endedAt: 3, rolls: 1 })
  // Nor while the empty one still runs.
  const live = lastSession([...real, e(10, { kind: 'session', session: 'start' })])
  expect(live).toMatchObject({ startedAt: 1, endedAt: 3, rolls: 1 })
})

// r5 A10 (MD5-18): three minutes in Mediate after the session replaced it.
test('play after the session ended, with none started, does not replace it', () => {
  const record = lastSession([
    e(1, { kind: 'session', session: 'start' }),
    e(2, { kind: 'roll' }),
    e(3),
    e(4, { kind: 'session', session: 'end' }),
    e(10, { kind: 'role' }),
    e(11, { kind: 'roll' }),
    e(12, { kind: 'role' }),
  ])
  expect(record).toMatchObject({ startedAt: 1, endedAt: 4, rolls: 1, changes: 1 })
  // Started again, that play belongs to the new session.
  const next = lastSession([
    e(1, { kind: 'session', session: 'start' }),
    e(2, { kind: 'roll' }),
    e(4, { kind: 'session', session: 'end' }),
    e(11, { kind: 'roll' }),
    e(20, { kind: 'session', session: 'start' }),
  ])
  expect(next).toMatchObject({ startedAt: 11, endedAt: null, rolls: 1 })
})

test('with no play anywhere, the newest session shows, empty as it is', () => {
  const record = lastSession([
    e(1, { kind: 'session', session: 'start' }),
    e(4, { kind: 'session', session: 'end' }),
  ])
  expect(record).toMatchObject({ startedAt: 1, endedAt: 4, rolls: 0, lines: [] })
})

test('the newest session: what happened between its start and its end, newest first', () => {
  const events = [
    e(1, { kind: 'session', session: 'start' }),
    e(2),
    e(3, { kind: 'session', session: 'end' }),
    e(4),
    e(10, { kind: 'session', session: 'start' }),
    e(11, { kind: 'roll' }),
    e(12),
    e(13),
    e(20, { kind: 'session', session: 'end' }),
  ]
  const record = lastSession([...events].reverse())
  // What was played between the two sessions counts with the second.
  expect(record).toMatchObject({ startedAt: 4, endedAt: 20, rolls: 1, changes: 3 })
  expect(record?.lines.map((l) => l.ts)).toEqual([13, 12, 11, 4])
})

test('a session still running has no end', () => {
  const record = lastSession([e(1, { kind: 'session', session: 'start' }), e(2)])
  expect(record?.endedAt).toBeNull()
  expect(record?.lines).toHaveLength(1)
})

test('rolls and changes count the same for everyone: private rolls apart, an accepted proposal and its undoing as changes (r3 K6)', () => {
  const start = e(1, { kind: 'session', session: 'start' })
  const table = [
    e(2, { kind: 'roll' }),
    e(3, { kind: 'roll', revealed: true }),
    e(4, { kind: 'proposal', text: 'Mediator proposes Rook HP → 7' }),
    e(5, { kind: 'proposal', answer: 'accepted' }),
    e(6, { kind: 'proposal', answer: 'undone' }),
    e(7),
  ]
  const players = lastSession([start, ...table])
  expect(players).toMatchObject({ rolls: 2, privateRolls: 0, changes: 3 })
  // A Mediator is served the private rolls too: listed, counted apart.
  const mediators = lastSession([start, ...table, e(8, { kind: 'roll', private: true })])
  expect(mediators).toMatchObject({ rolls: 2, privateRolls: 1, changes: 3 })
})
