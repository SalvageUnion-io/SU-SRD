import { describe, expect, test } from 'bun:test'
import type { TableEvent } from '../../rooms/game/events'
import {
  doneToMine,
  downOf,
  endedSession,
  eventsToTell,
  gameOfPage,
  gamesGone,
  leavingOnPurpose,
  lostRole,
  myTurn,
  newsOver,
  onGamePages,
  pausedTitle,
  pinnedAlert,
  pinnedRole,
  pinnedSays,
  resumedTitle,
  shownNotices,
  stackNotices,
  standingDownOnPurpose,
  stripLine,
} from '../tableNotices.model'

const event = (over: Partial<TableEvent> & { _id: string }): TableEvent => ({
  ts: 1,
  kind: 'vitals',
  text: 'Nell · HP 8 → 5',
  actorId: 'nell',
  ...over,
})

describe('eventsToTell', () => {
  test('the first answer is history: nothing toasts', () => {
    const first = eventsToTell([event({ _id: 'a' })], null, 'me')
    expect(first.tell).toEqual([])
    expect(first.heard.get('a')).toBe('Nell · HP 8 → 5')
  })

  const alert = (over: Partial<TableEvent> & { _id: string }) =>
    event({ kind: 'alert', text: 'Mediator · Raiders close in', actorId: 'gm', ...over })

  test('a new event that needs a look toasts once; a rewritten line toasts again under its id', () => {
    const { heard } = eventsToTell([], null, 'me')
    const one = eventsToTell([alert({ _id: 'a' })], heard, 'me')
    expect(one.tell.map((e) => e._id)).toEqual(['a'])
    expect(eventsToTell([alert({ _id: 'a' })], one.heard, 'me').tell).toEqual([])
    // A veiled roll revealed: its line changed, so its toast updates in place.
    const veiled = event({ _id: 'r', kind: 'roll', text: 'Mediator rolled · 9', mediator: true })
    const rolled = eventsToTell([veiled], one.heard, 'me')
    expect(rolled.tell).toEqual([veiled])
    const shown = { ...veiled, text: 'Mediator · Veteran · Rifle · 9' }
    expect(eventsToTell([shown], rolled.heard, 'me').tell).toEqual([shown])
  })

  test('crew toasts are quiet (r2 C4): a crewmate’s vitals, actions, boarding and rolls go to the Feed alone', () => {
    const { heard } = eventsToTell([], null, 'me')
    const quiet = [
      event({ _id: 'v' }),
      event({ _id: 'a', kind: 'action', text: 'Nell uses Crush' }),
      event({ _id: 'b', kind: 'board', text: 'Nell boards Reaper' }),
      event({ _id: 'as', kind: 'assign', text: 'Razor is assigned to Nell' }),
      event({ _id: 'j', kind: 'join', text: 'Nell joined the Game' }),
      event({ _id: 'r', kind: 'roll', text: 'Nell · Core Mechanic · 14 · Success' }),
    ]
    expect(eventsToTell(quiet, heard, 'me').tell).toEqual([])
    const loud = [
      event({ _id: 'p', kind: 'proposal', text: 'Mediator proposes Nell HP → 5', ts: 1 }),
      alert({ _id: 'al', ts: 2 }),
      event({ _id: 's', kind: 'session', text: 'Med started the group session', ts: 3 }),
      event({ _id: 'd', kind: 'downtime', text: 'Med began Downtime', ts: 4 }),
      event({ _id: 'mr', kind: 'roll', text: 'Mediator rolled · 9', mediator: true, ts: 5 }),
    ]
    expect(eventsToTell([...quiet, ...loud], heard, 'me').tell.map((e) => e._id)).toEqual([
      'p',
      'al',
      's',
      'd',
      'mr',
    ])
  })

  test('a hand over replays nothing: a Mediator’s own copy of a private or veiled roll never toasts (r3 A2)', () => {
    const { heard } = eventsToTell(
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
    expect(eventsToTell(crossed, heard, 'me').tell).toEqual([])
    // A revealed one is the table's, and toasts.
    const shown = event({
      _id: 'p',
      kind: 'roll',
      text: 'Old · Vex · Rifle · 3',
      actorId: 'old',
      revealed: true,
      mediator: true,
    })
    expect(eventsToTell([shown], heard, 'me').tell).toEqual([shown])
  })

  test('never my own act, and never the Stop Sign, which the banner says', () => {
    const { heard } = eventsToTell([], null, 'me')
    const events = [
      alert({ _id: 'mine', actorId: 'me' }),
      event({ _id: 'stop', kind: 'stop', actorId: null }),
      alert({ _id: 'theirs', ts: 2 }),
    ]
    expect(eventsToTell(events, heard, 'me').tell.map((e) => e._id)).toEqual(['theirs'])
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
    const { heard } = eventsToTell([], null, 'nell')
    expect(eventsToTell([made], heard, 'nell').tell).toEqual([made])
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

describe('the one strip (r6 A1, r7 A1)', () => {
  type Rank = 'stop' | 'role' | 'down' | 'alert' | 'answer' | 'turn' | 'news'
  const n = (key: string, rank: Rank, ts: number) => ({
    key,
    rank,
    ts,
    dismissible: rank === 'news' || rank === 'alert',
  })

  test('the Stop Sign leads, then You now mediate, my Down, an answer, then the rest newest first', () => {
    const stacked = stackNotices([
      n('alert', 'alert', 300),
      n('turn', 'turn', 50),
      n('ended', 'news', 900),
      n('proposal', 'answer', 100),
      n('down', 'down', 20),
      n('role', 'role', 10),
      n('stop', 'stop', 1),
    ])
    expect(stacked.map((notice) => notice.key)).toEqual([
      'stop',
      'role',
      'down',
      'proposal',
      'ended',
      'alert',
      'turn',
    ])
  })

  test('one notice shows; the rest wait behind the count; with none the strip says nothing (r7 A2)', () => {
    const shown = shownNotices([n('turn', 'turn', 0), n('ended', 'news', 900)])
    expect(shown.top?.key).toBe('ended')
    expect(shown.rest.map((notice) => notice.key)).toEqual(['turn'])
    expect(shownNotices([])).toEqual({ top: null, rest: [] })
  })
})

describe('newsOver (r7 A1): a notice ends when what it reports is over', () => {
  const ended = event({ _id: 't1', kind: 'turn', text: 'Pickle ended their turn', ts: 10 })
  const given = event({
    _id: 't2',
    kind: 'turn',
    text: 'The Mediator gave Hotdog the turn',
    ts: 20,
  })
  const roll = event({ _id: 'r', kind: 'roll', text: 'Mediator · Group Initiative · 15', ts: 5 })
  const down = event({ _id: 'd', text: 'Pumpkin · HP 3 → 0', ts: 12 })

  test('"ended their turn" and an initiative roll end when the next turn starts', () => {
    expect(newsOver(ended, [ended])).toBe(false)
    expect(newsOver(ended, [ended, given])).toBe(true)
    expect(newsOver(roll, [roll, ended])).toBe(true)
    // A unit Down is not over because a turn moved.
    expect(newsOver(down, [down, given])).toBe(false)
  })

  test('any news ends when the session ends or Downtime moves', () => {
    const end = event({
      _id: 'e',
      kind: 'session',
      session: 'end',
      text: 'Sam ended the group session',
      ts: 30,
    })
    const downtime = event({ _id: 'dt', kind: 'downtime', text: 'Sam began Downtime', ts: 40 })
    expect(newsOver(down, [down, end])).toBe(true)
    expect(newsOver(end, [end, downtime])).toBe(true)
    expect(newsOver(down, [down])).toBe(false)
  })
})

describe('doneToMine (r6 A3): a toast for a change another made to your own unit', () => {
  const hit = (over: Partial<TableEvent> & { _id: string }) =>
    event({ vital: { who: 'Nell', label: 'HP', from: 8, to: 5, unitId: 'p-mine' }, ...over })
  const { heard } = eventsToTell([], null, 'me')
  const mine = new Set(['p-mine'])

  test('another member’s change to my unit is told; the first answer is history', () => {
    expect(doneToMine([hit({ _id: 'a' })], null, 'me', mine)).toBeNull()
    expect(doneToMine([hit({ _id: 'a' })], heard, 'me', mine)?._id).toBe('a')
  })

  test('not my own change, nor a change to someone else’s unit', () => {
    expect(doneToMine([hit({ _id: 'a', actorId: 'me' })], heard, 'me', mine)).toBeNull()
    expect(doneToMine([hit({ _id: 'a' })], heard, 'me', new Set(['other']))).toBeNull()
  })
})

describe('a unit Down is the table’s news (r6 A3)', () => {
  const down = (unit: string) => `${unit} is Down`
  test('a vital or an accepted proposal at 0 SP or HP is told, as "<unit> is Down"', () => {
    const { heard } = eventsToTell([], null, 'me')
    const hit = event({ _id: 'v0', text: 'Thresher (Razor) · SP 15 → 0' })
    const accepted = event({
      _id: 'p0',
      kind: 'proposal',
      text: 'Ash accepted: Thresher SP 15 → 0',
    })
    const scratch = event({ _id: 'v1', text: 'Thresher (Razor) · SP 15 → 10' })
    expect(eventsToTell([hit, accepted, scratch], heard, 'me').tell.map((e) => e._id)).toEqual([
      'v0',
      'p0',
    ])
    expect(stripLine(hit, down)).toBe('Thresher (Razor) is Down')
    expect(stripLine(accepted, down)).toBe('Thresher is Down')
    expect(downOf(scratch)).toBeNull()
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
    const { heard } = eventsToTell([], null, 'me')
    const turn = event({ _id: 't', kind: 'turn', text: 'Pickle ended their turn', actorId: 'ada' })
    expect(eventsToTell([turn], heard, 'gm', true).tell).toEqual([turn])
    expect(eventsToTell([turn], heard, 'ben', false).tell).toEqual([])
    expect(eventsToTell([turn], heard, 'ada', true).tell).toEqual([])
  })

  test('the role moving is told to the whole table, never to whoever moved it', () => {
    const { heard } = eventsToTell([], null, 'me')
    const role = event({
      _id: 'r',
      kind: 'role',
      text: 'Ash now mediates this Game',
      actorId: 'org',
      about: 'ash',
    })
    expect(eventsToTell([role], heard, 'me').tell).toEqual([role])
    expect(eventsToTell([role], heard, 'ash').tell).toEqual([role])
    expect(eventsToTell([role], heard, 'org').tell).toEqual([])
  })
})

describe('the session’s end (r2 C5)', () => {
  const end = event({ _id: 'e', kind: 'session', session: 'end', actorId: 'gm', ts: 1000 })

  test('it is news to the other members, never to whoever ended it', () => {
    expect(endedSession([end], 2000, 'me')).toBe(1000)
    expect(endedSession([end], 2000, 'gm')).toBeNull()
    expect(endedSession([end], 1000 + 10 * 60_000, 'me')).toBeNull()
  })

  test('over once Downtime begins (r7 A1)', () => {
    const downtime = event({ _id: 'dt', kind: 'downtime', text: 'Sam began Downtime', ts: 1500 })
    expect(endedSession([end, downtime], 2000, 'me')).toBeNull()
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
