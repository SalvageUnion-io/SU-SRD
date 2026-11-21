import { describe, expect, test } from 'bun:test'
import type { TableEvent } from '../../rooms/game/events'
import {
  eventsToToast,
  gamesGone,
  leavingOnPurpose,
  pausedTitle,
  pinnedAlert,
  resumedTitle,
} from '../tableNotices.model'

const event = (over: Partial<TableEvent> & { _id: string }): TableEvent => ({
  ts: 1,
  kind: 'vitals',
  text: 'Nell · HP 8 → 5',
  actorId: 'nell',
  ...over,
})

describe('eventsToToast', () => {
  test('the first answer is history: nothing toasts', () => {
    const first = eventsToToast([event({ _id: 'a' })], null, 'me')
    expect(first.toast).toEqual([])
    expect(first.heard.get('a')).toBe('Nell · HP 8 → 5')
  })

  test('a new event from someone else toasts once; a merged repeat toasts again under its id', () => {
    const { heard } = eventsToToast([], null, 'me')
    const one = eventsToToast([event({ _id: 'a' })], heard, 'me')
    expect(one.toast.map((e) => e._id)).toEqual(['a'])
    expect(eventsToToast([event({ _id: 'a' })], one.heard, 'me').toast).toEqual([])
    const merged = event({ _id: 'a', text: 'Nell · HP 8 → 3' })
    expect(eventsToToast([merged], one.heard, 'me').toast).toEqual([merged])
  })

  test('never my own act, and never the Stop Sign, which the banner says', () => {
    const { heard } = eventsToToast([], null, 'me')
    const events = [
      event({ _id: 'mine', actorId: 'me' }),
      event({ _id: 'stop', kind: 'stop', actorId: null }),
      event({ _id: 'theirs', ts: 2 }),
    ]
    expect(eventsToToast(events, heard, 'me').toast.map((e) => e._id)).toEqual(['theirs'])
  })

  // MD-23: the unit's old holder is told in their own words
  // (`assignmentNotices`), so the table's line is not a second toast for them.
  test('an assignment taken from me is not toasted twice; everyone else hears the line', () => {
    const { heard } = eventsToToast([], null, 'me')
    const taken = event({
      _id: 'un',
      kind: 'assign',
      text: 'Razor is unassigned',
      actorId: 'gm',
      about: 'me',
    })
    expect(eventsToToast([taken], heard, 'me').toast).toEqual([])
    expect(eventsToToast([taken], heard, 'nell').toast).toEqual([taken])
  })
})

describe('pinnedAlert', () => {
  const alert = event({
    _id: 'al',
    kind: 'alert',
    text: 'Mediator · Raiders close in',
    actorId: 'gm',
    ts: 1000,
  })
  test('the newest recent alert stays pinned until dismissed or old', () => {
    expect(pinnedAlert([alert], new Set(), 'me', 2000)).toBe(alert)
    expect(pinnedAlert([alert], new Set(['al']), 'me', 2000)).toBeNull()
    expect(pinnedAlert([alert], new Set(), 'me', 1000 + 10 * 60_000)).toBeNull()
    expect(pinnedAlert([alert], new Set(), 'gm', 2000)).toBeNull()
  })
})

test('the paused title wears its prefix once, and loses it on resume', () => {
  expect(pausedTitle('Play', 'Paused · ')).toBe('Paused · Play')
  expect(pausedTitle('Paused · Play', 'Paused · ')).toBe('Paused · Play')
  expect(resumedTitle('Paused · Play', 'Paused · ')).toBe('Play')
})

describe('gamesGone (r2 B4)', () => {
  const rust = { _id: 'g1', name: 'Rust Choir' }
  const coast = { _id: 'g2', name: 'Rust Coast' }

  test('a Game the viewer is in no longer is told once', () => {
    expect(gamesGone([rust, coast], [coast])).toEqual([rust])
    expect(gamesGone([coast], [coast])).toEqual([])
  })

  test('never their own leaving, and a leave that failed is forgotten', () => {
    leavingOnPurpose('g1')
    expect(gamesGone([rust], [])).toEqual([])
    leavingOnPurpose('g1')()
    expect(gamesGone([rust], [])).toEqual([rust])
  })
})
