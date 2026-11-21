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

test('no session in the stream, no record', () => {
  expect(lastSession([e(1), e(2)])).toBeNull()
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
    e(21),
  ]
  const record = lastSession([...events].reverse())
  expect(record).toMatchObject({ startedAt: 10, endedAt: 20, rolls: 1, changes: 2 })
  expect(record?.lines.map((l) => l.ts)).toEqual([13, 12, 11])
})

test('a session still running has no end', () => {
  const record = lastSession([e(1, { kind: 'session', session: 'start' }), e(2)])
  expect(record?.endedAt).toBeNull()
  expect(record?.lines).toHaveLength(1)
})
