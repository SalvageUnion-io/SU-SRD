import { describe, expect, test } from 'bun:test'
import type { TableEvent } from '../../rooms/game/events'
import {
  endedSession,
  eventsToToast,
  gameOfPage,
  gamesGone,
  leavingOnPurpose,
  lostRole,
  myTurn,
  onGamePages,
  pausedTitle,
  pinnedAlert,
  pinnedRole,
  pinnedSays,
  resumedTitle,
  shownNotices,
  stackNotices,
  standingDownOnPurpose,
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

  const alert = (over: Partial<TableEvent> & { _id: string }) =>
    event({ kind: 'alert', text: 'Mediator · Raiders close in', actorId: 'gm', ...over })

  test('a new event that needs a look toasts once; a rewritten line toasts again under its id', () => {
    const { heard } = eventsToToast([], null, 'me')
    const one = eventsToToast([alert({ _id: 'a' })], heard, 'me')
    expect(one.toast.map((e) => e._id)).toEqual(['a'])
    expect(eventsToToast([alert({ _id: 'a' })], one.heard, 'me').toast).toEqual([])
    // A veiled roll revealed: its line changed, so its toast updates in place.
    const veiled = event({ _id: 'r', kind: 'roll', text: 'Mediator rolled · 9', mediator: true })
    const rolled = eventsToToast([veiled], one.heard, 'me')
    expect(rolled.toast).toEqual([veiled])
    const shown = { ...veiled, text: 'Mediator · Veteran · Rifle · 9' }
    expect(eventsToToast([shown], rolled.heard, 'me').toast).toEqual([shown])
  })

  test('crew toasts are quiet (r2 C4): a crewmate’s vitals, actions, boarding and rolls go to the Feed alone', () => {
    const { heard } = eventsToToast([], null, 'me')
    const quiet = [
      event({ _id: 'v' }),
      event({ _id: 'a', kind: 'action', text: 'Nell uses Crush' }),
      event({ _id: 'b', kind: 'board', text: 'Nell boards Reaper' }),
      event({ _id: 'as', kind: 'assign', text: 'Razor is assigned to Nell' }),
      event({ _id: 'j', kind: 'join', text: 'Nell joined the Game' }),
      event({ _id: 'r', kind: 'roll', text: 'Nell · Core Mechanic · 14 · Success' }),
    ]
    expect(eventsToToast(quiet, heard, 'me').toast).toEqual([])
    const loud = [
      event({ _id: 'p', kind: 'proposal', text: 'Mediator proposes Nell HP → 5', ts: 1 }),
      alert({ _id: 'al', ts: 2 }),
      event({ _id: 's', kind: 'session', text: 'Med started the group session', ts: 3 }),
      event({ _id: 'd', kind: 'downtime', text: 'Med began Downtime', ts: 4 }),
      event({ _id: 'mr', kind: 'roll', text: 'Mediator rolled · 9', mediator: true, ts: 5 }),
    ]
    expect(eventsToToast([...quiet, ...loud], heard, 'me').toast.map((e) => e._id)).toEqual([
      'p',
      'al',
      's',
      'd',
      'mr',
    ])
  })

  test('a hand over replays nothing: a Mediator’s own copy of a private or veiled roll never toasts (r3 A2)', () => {
    const { heard } = eventsToToast(
      [
        event({
          _id: 'v',
          kind: 'roll',
          text: 'Mediator rolled · 9',
          actorId: 'old',
          mediator: true,
        }),
      ],
      null,
      'me'
    )
    // The role arrives, and with it every earlier roll as a Mediator reads it.
    const crossed = [
      event({
        _id: 'v',
        kind: 'roll',
        text: 'Old · Veteran · Rifle · 9',
        actorId: 'old',
        veiled: true,
      }),
      event({
        _id: 'p',
        kind: 'roll',
        text: 'Old · Vex · Rifle · 3',
        actorId: 'old',
        private: true,
      }),
      event({
        _id: 'p2',
        kind: 'roll',
        text: 'Mediator · Vex · 15',
        actorId: 'old',
        private: true,
        mediator: true,
      }),
    ]
    expect(eventsToToast(crossed, heard, 'me').toast).toEqual([])
    // A revealed one is the table's, and toasts.
    const shown = event({
      _id: 'p',
      kind: 'roll',
      text: 'Old · Vex · Rifle · 3',
      actorId: 'old',
      revealed: true,
      mediator: true,
    })
    expect(eventsToToast([shown], heard, 'me').toast).toEqual([shown])
  })

  test('never my own act, and never the Stop Sign, which the banner says', () => {
    const { heard } = eventsToToast([], null, 'me')
    const events = [
      alert({ _id: 'mine', actorId: 'me' }),
      event({ _id: 'stop', kind: 'stop', actorId: null }),
      alert({ _id: 'theirs', ts: 2 }),
    ]
    expect(eventsToToast(events, heard, 'me').toast.map((e) => e._id)).toEqual(['theirs'])
  })
})

describe('pinnedSays (r3 H2): no toast for what the pinned strip is saying', () => {
  const none = { alertId: null, roleId: null, sessionLive: false, sessionEnded: false }
  const alert = event({ _id: 'al', kind: 'alert', text: 'Mediator · Raiders close in' })

  test('the pinned alert and the pinned hand over, by id', () => {
    expect(pinnedSays(alert, { ...none, alertId: 'al' }, 'me')).toBe(true)
    expect(pinnedSays(alert, { ...none, alertId: 'other' }, 'me')).toBe(false)
    const role = event({ _id: 'r', kind: 'role', text: 'Me now mediates this Game', about: 'me' })
    expect(pinnedSays(role, { ...none, roleId: 'r' }, 'me')).toBe(true)
    expect(pinnedSays(role, none, 'me')).toBe(false)
  })

  test('a proposal that is mine to answer is pinned; a crewmate’s still toasts', () => {
    const mine = event({ _id: 'p', kind: 'proposal', text: 'Mediator proposes X', about: 'me' })
    expect(pinnedSays(mine, none, 'me')).toBe(true)
    expect(pinnedSays({ ...mine, about: 'nell' }, none, 'me')).toBe(false)
    // A proposal accepted or declined is about nobody: the table hears it.
    const answered = event({ _id: 'a', kind: 'proposal', text: 'Nell accepted: X' })
    expect(pinnedSays(answered, none, 'me')).toBe(false)
  })

  test('the session starting and ending, where the strip says it', () => {
    const start = event({ _id: 's', kind: 'session', session: 'start', text: 'started' })
    const end = event({ _id: 'e', kind: 'session', session: 'end', text: 'ended' })
    expect(pinnedSays(start, { ...none, sessionLive: true }, 'me')).toBe(true)
    expect(pinnedSays(start, { ...none, sessionEnded: true }, 'me')).toBe(false)
    expect(pinnedSays(end, { ...none, sessionEnded: true }, 'me')).toBe(true)
    expect(pinnedSays(end, none, 'me')).toBe(false)
    expect(pinnedSays(event({ _id: 'v' }), { ...none, sessionLive: true }, 'me')).toBe(false)
  })
})

describe('pinnedRole (r2 B3)', () => {
  const made = event({
    _id: 'r1',
    ts: 1000,
    kind: 'role',
    text: 'Nell now mediates this Game',
    actorId: 'org',
    about: 'nell',
  })

  test('whoever was handed the table is told, by toast and by a pin, until they dismiss it', () => {
    const { heard } = eventsToToast([], null, 'nell')
    expect(eventsToToast([made], heard, 'nell').toast).toEqual([made])
    expect(pinnedRole([made], new Set(), 'nell', 2000)).toBe(made)
    expect(pinnedRole([made], new Set(['r1']), 'nell', 2000)).toBeNull()
    expect(pinnedRole([made], new Set(), 'ash', 2000)).toBeNull()
  })

  test('not for an Organiser who appointed themselves, nor once the table moved on', () => {
    expect(pinnedRole([{ ...made, actorId: 'nell' }], new Set(), 'nell', 2000)).toBeNull()
    const next = { ...made, _id: 'r2', ts: 1500, about: 'ash' }
    expect(pinnedRole([made, next], new Set(), 'nell', 2000)).toBeNull()
    expect(pinnedRole([made], new Set(), 'nell', 1000 + 8 * 24 * 60 * 60_000)).toBeNull()
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

  test('it clears when a new session starts (r2 C5)', () => {
    const start = (ts: number) =>
      event({ _id: `s${ts}`, kind: 'session', session: 'start', actorId: 'gm', ts })
    // Sent during the running session: pinned.
    expect(pinnedAlert([start(500), alert], new Set(), 'me', 2000)).toBe(alert)
    // The next session began after it: last session's, so gone.
    expect(pinnedAlert([start(500), alert, start(1500)], new Set(), 'me', 2000)).toBeNull()
  })
})

describe('pinnedAlert clears itself (r3 H1)', () => {
  const alert = event({
    _id: 'al',
    kind: 'alert',
    text: 'Mediator · Dust',
    actorId: 'gm',
    ts: 1000,
  })
  const session = (ts: number, session: 'start' | 'end') =>
    event({ _id: `s${ts}`, kind: 'session', session, actorId: 'gm', ts })

  test('it unpins when the session ends; one sent after the end pins', () => {
    const during = [session(500, 'start'), alert, session(1500, 'end')]
    expect(pinnedAlert(during, new Set(), 'me', 2000)).toBeNull()
    expect(
      pinnedAlert([session(500, 'start'), session(900, 'end'), alert], new Set(), 'me', 2000)
    ).toBe(alert)
  })

  test('it is not shown to someone who joined after it was sent', () => {
    const joined = (ts: number, actorId: string) =>
      event({ _id: `j${ts}`, kind: 'join', text: 'Pip joined the Game', actorId, ts })
    expect(pinnedAlert([alert, joined(1500, 'me')], new Set(), 'me', 2000)).toBeNull()
    expect(pinnedAlert([joined(500, 'me'), alert], new Set(), 'me', 2000)).toBe(alert)
    // Somebody else joining, or a member removed by the viewer, changes nothing.
    const removed = event({
      _id: 'l',
      kind: 'leave',
      text: 'Pip was removed',
      actorId: 'me',
      ts: 1500,
    })
    expect(pinnedAlert([alert, joined(1500, 'pip'), removed], new Set(), 'me', 2000)).toBe(alert)
  })

  test('which Game a page is, so an alert is never pinned over another Game’s', () => {
    const games = [
      { id: 'g1', root: '/games/g1', pilotRoots: ['/pilots/p1'] },
      { id: 'g2', root: '/games/g2', pilotRoots: [] },
    ]
    expect(gameOfPage('/games/g2/mediate', games)).toBe('g2')
    expect(gameOfPage('/pilots/p1/play', games)).toBe('g1')
    expect(gameOfPage('/chassis/mule/', games)).toBeNull()
  })
})

describe('the one strip (r3 H1)', () => {
  const n = (key: string, rank: 'alert' | 'answer' | 'turn' | 'news', ts: number) => ({
    key,
    rank,
    ts,
    dismissible: rank === 'news' || rank === 'alert',
  })

  test('what waits on an answer leads, then my turn, then the news, newest first', () => {
    const stacked = stackNotices([
      n('alert', 'news', 300),
      n('turn', 'turn', 0),
      n('ended', 'news', 900),
      n('proposal', 'answer', 100),
      n('role', 'news', 500),
    ])
    expect(stacked.map((notice) => notice.key)).toEqual([
      'proposal',
      'turn',
      'ended',
      'role',
      'alert',
    ])
  })

  test('the Mediator’s alert is above "Your turn" and never one of the counted (r4 B2)', () => {
    const shown = shownNotices([
      n('turn', 'turn', 0),
      n('ended', 'news', 900),
      n('alert', 'alert', 300),
    ])
    expect(shown.alerts.map((notice) => notice.key)).toEqual(['alert'])
    expect(shown.top?.key).toBe('turn')
    expect(shown.rest.map((notice) => notice.key)).toEqual(['ended'])
    // An alert alone is just itself; Accept still leads the strip under one.
    expect(shownNotices([n('alert', 'alert', 300)])).toMatchObject({ top: null, rest: [] })
    expect(shownNotices([n('alert', 'alert', 300), n('proposal', 'answer', 1)]).top?.key).toBe(
      'proposal'
    )
  })
})

describe('the Mediator’s role taken back (r3 A4)', () => {
  test('whoever loses it is told once, never for their own hand over, never at first sight', () => {
    expect(lostRole(true, false, 'g1')).toBe(true)
    expect(lostRole(null, false, 'g1')).toBe(false)
    expect(lostRole(false, false, 'g1')).toBe(false)
    expect(lostRole(true, true, 'g1')).toBe(false)
    standingDownOnPurpose('g1')
    expect(lostRole(true, false, 'g1')).toBe(false)
    expect(lostRole(true, false, 'g1')).toBe(true)
    standingDownOnPurpose('g1')()
    expect(lostRole(true, false, 'g1')).toBe(true)
  })

  test('a player ending their turn is told to the Mediator alone (r4 B1)', () => {
    const { heard } = eventsToToast([], null, 'me')
    const turn = event({ _id: 't', kind: 'turn', text: 'Pickle ended their turn', actorId: 'ada' })
    expect(eventsToToast([turn], heard, 'gm', true).toast).toEqual([turn])
    expect(eventsToToast([turn], heard, 'ben', false).toast).toEqual([])
    expect(eventsToToast([turn], heard, 'ada', true).toast).toEqual([])
  })

  test('the role moving is told to the whole table, never to whoever moved it', () => {
    const { heard } = eventsToToast([], null, 'me')
    const role = event({
      _id: 'r',
      kind: 'role',
      text: 'Ash now mediates this Game',
      actorId: 'org',
      about: 'ash',
    })
    expect(eventsToToast([role], heard, 'me').toast).toEqual([role])
    expect(eventsToToast([role], heard, 'ash').toast).toEqual([role])
    expect(eventsToToast([role], heard, 'org').toast).toEqual([])
  })
})

describe('the session’s end (r2 C5)', () => {
  const end = event({ _id: 'e', kind: 'session', session: 'end', actorId: 'gm', ts: 1000 })

  test('it is news to the other members, never to whoever ended it', () => {
    expect(endedSession([end], 2000, 'me')).toBe(1000)
    expect(endedSession([end], 2000, 'gm')).toBeNull()
    expect(endedSession([end], 1000 + 10 * 60_000, 'me')).toBeNull()
  })

  test('never to someone who joined after it ended, nor on a later day (r4 B5)', () => {
    const joined = (ts: number) =>
      event({ _id: `j${ts}`, kind: 'join', text: 'Pip joined the Game', actorId: 'me', ts })
    expect(endedSession([end, joined(1500)], 2000, 'me')).toBeNull()
    expect(endedSession([joined(500), end], 2000, 'me')).toBe(1000)
    // Ended two minutes before midnight, opened three minutes after it.
    const late = new Date(2026, 10, 21, 23, 58).getTime()
    const night = event({ _id: 'n', kind: 'session', session: 'end', actorId: 'gm', ts: late })
    expect(endedSession([night], late + 60_000, 'me')).toBe(late)
    expect(endedSession([night], late + 5 * 60_000, 'me')).toBeNull()
  })

  test('and only on that Game’s pages', () => {
    const pages = (path: string) => onGamePages(path, '/games/g1', ['/pilots/p1'])
    expect(pages('/games/g1/')).toBe(true)
    expect(pages('/games/g1/mediate')).toBe(true)
    expect(pages('/pilots/p1/play')).toBe(true)
    expect(pages('/pilots/p1')).toBe(true)
    expect(pages('/games/g10')).toBe(false)
    expect(pages('/games/g2')).toBe(false)
    expect(pages('/build/encounters/e1')).toBe(false)
    expect(pages('/pilots/p2/play')).toBe(false)
  })
})

describe('myTurn (r2 E1)', () => {
  const pilots = [{ id: 'p1' }, { id: 'p2' }]
  test('the viewer’s own pilot the Mediator marked, or nobody', () => {
    expect(myTurn('p2', pilots)).toEqual({ id: 'p2' })
    expect(myTurn('p9', pilots)).toBeNull()
    expect(myTurn(undefined, pilots)).toBeNull()
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
