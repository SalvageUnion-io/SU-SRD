/**
 * The right column's pure models (play.md §7–§9): the Crew's lines and the
 * LIVE stamp's "N here", the Feed's one list, the pinned tables, the landing's
 * channel rows, the read-only words and the roll log.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import type { TableEvent } from '../../rooms/game/events'
import { channelButtonLabel, channelTag, postsToLabel } from '../channels.model'
import { crewLineLabel, crewSeatLines, hereCount, pairedMech } from '../crew.model'
import { mineText, playFeedEntries, tableLine } from '../feed.model'
import { liveLabel, playReadOnly } from '../play.model'
import type { PlayRoll } from '../playRolls.model'
import {
  clearPlayRolls,
  isDiceRoll,
  onPlayRoll,
  playRollDescription,
  recordPlayChange,
  recordPlayRoll,
  reportingRoll,
  rollLogEntry,
  setPrivateRolls,
  usePlayRollLog,
  veiledRollDescription,
} from '../playRolls.model'
import { proposalChange } from '../proposalAnswer.model'
import { findTables, pinnedTables } from '../tables.model'
import type { AlertLine, PendingProposal, RollLine } from '../useGameFeed'
import { CREW_HERE, crewAt } from './crewFixture'

describe('the Crew (play.md §7)', () => {
  const lines = crewSeatLines(crewAt(), [], 'bonesaw', CREW_HERE)

  test('one line per other seat: the pilot this screen plays is left out', () => {
    expect(lines.map((l) => l.name)).toEqual(['Mags', 'Rook', 'Wren'])
  })

  test('only who is playing: an unassigned pre-gen is no crewmate, and a line names its player (r4 B8)', () => {
    const crew = crewAt()
    const [, mags] = crew.pilots
    if (mags === undefined) throw new Error('fixture')
    crew.pilots[1] = { ...mags, ownerName: 'Ada' }
    crew.pilots.push({
      ...mags,
      _id: 'r-pre',
      appId: 'pre',
      linkId: 'pre',
      name: 'Driftwood',
      ownerId: null,
    })
    const listed = crewSeatLines(crew, [], 'bonesaw', CREW_HERE)
    expect(listed.map((l) => l.name)).toEqual(['Mags', 'Rook', 'Wren'])
    expect(listed.map((l) => l.player)).toEqual(['Ada', null, null])
    const [first] = listed
    if (first === undefined) throw new Error('fixture')
    expect(crewLineLabel(first)).toStartWith('Mags, Played by Ada, here, ')
  })

  test('presence is the player having the Game open: Wren’s player has not', () => {
    expect(lines.map((l) => [l.name, l.present])).toEqual([
      ['Mags', true],
      ['Rook', true],
      ['Wren', false],
    ])
    // Before the room answers, nobody is here.
    expect(crewSeatLines(crewAt(), [], 'bonesaw', null).some((l) => l.present)).toBe(false)
  })

  test('the mount: Boarded · <mech>, or On foot', () => {
    expect(lines.map((l) => l.mount)).toEqual(['Boarded · Atlas', 'On foot', 'Boarded · Mule'])
    expect(lines.map((l) => l.boardedIn)).toEqual(['Atlas', null, 'Mule'])
  })

  test('one vital: what needs looking at (▲), else SP aboard or HP on foot', () => {
    const [mags, rook, wren] = lines
    expect(mags?.vital).toEqual({ label: 'SP', value: '22', attention: false })
    expect(rook?.vital).toEqual({ label: 'HP', value: '4', attention: true })
    expect(rook?.problem).toBe('Injured')
    // An unset SP reads full, as the sheet reads it.
    expect(wren?.vital).toEqual({ label: 'SP', value: '26', attention: false })
  })

  test('a crewmate whose mech overheats is flagged by its Heat', () => {
    const crew = crewAt()
    const atlas = crew.mechs[0]
    if (atlas === undefined) throw new Error('fixture')
    crew.mechs[0] = {
      ...atlas,
      currentHeat: 9,
      status: { ...(atlas.status ?? ({} as never)), overheating: true },
      attention: true,
    }
    const mags = crewSeatLines(crew, [], 'bonesaw', CREW_HERE)[0]
    expect(mags?.vital).toEqual({ label: 'Heat', value: '9', attention: true })
  })

  test('a crewmate whose mech is shut down is flagged by it; otherwise by its SP', () => {
    const flagged = (status: Record<string, boolean>) => {
      const crew = crewAt()
      const atlas = crew.mechs[0]
      if (atlas === undefined) throw new Error('fixture')
      crew.mechs[0] = {
        ...atlas,
        status: { ...(atlas.status ?? ({} as never)), ...status },
        attention: true,
      }
      return crewSeatLines(crew, [], 'bonesaw', CREW_HERE)[0]?.vital
    }
    expect(flagged({ shutdown: true })).toEqual({
      label: 'Shut down',
      value: null,
      attention: true,
    })
    expect(flagged({})).toEqual({ label: 'SP', value: '22', attention: true })
  })

  test('every number with its maximum: HP and AP, and aboard the mech’s SP, EP and Heat (LG-16)', () => {
    expect(lines.map((l) => l.vitals.map((v) => `${v.label} ${v.value}`))).toEqual([
      ['HP 10/10', 'AP 5/5', 'SP 22/26', 'EP 6/6', 'Heat 0/9'],
      ['HP 4/10', 'AP 5/5'],
      ['HP 10/10', 'AP 5/5', 'SP 26/26', 'EP 6/6', 'Heat 0/9'],
    ])
  })

  test('the line’s words for a screen reader say all of it', () => {
    expect(lines.map(crewLineLabel)).toEqual([
      'Mags, here, Boarded · Atlas, SP 22, fine, HP 10/10, AP 5/5, SP 22/26, EP 6/6, Heat 0/9',
      'Rook, here, On foot, Injured, HP 4/10, AP 5/5',
      'Wren, away, Boarded · Mule, SP 26, fine, HP 10/10, AP 5/5, SP 26/26, EP 6/6, Heat 0/9',
    ])
  })

  test('the pair (crewPair): aboard their mech; on foot their assigned mech, for its MECH chip', () => {
    const crew = crewAt()
    const atlas = crew.mechs[0]
    const rook = crew.pilots[2]
    if (atlas === undefined || rook === undefined) throw new Error('fixture')
    // Mags climbs out of Atlas, which stays assigned to them.
    crew.pilots[1] = { ...(crew.pilots[1] ?? rook), boarded: false }
    const [mags, onFootRook, wren] = crewSeatLines(crew, [], 'bonesaw', CREW_HERE)
    expect(mags && pairedMech(mags)).toMatchObject({ name: 'Atlas' })
    expect(mags?.boardedIn).toBeNull()
    expect(onFootRook && pairedMech(onFootRook)).toBeNull()
    expect(wren && pairedMech(wren)).toMatchObject({ name: 'Mule' })
  })

  test('no crew read yet: no lines', () => {
    expect(crewSeatLines(null, [], 'bonesaw', CREW_HERE)).toEqual([])
  })

  test('"N here" counts every player at a seat who has the Game open, the viewer included, once each', () => {
    const pilots = crewAt().pilots
    expect(hereCount(pilots, CREW_HERE)).toBe(3)
    expect(hereCount([...pilots, { ownerId: [...CREW_HERE][0] ?? 'missing' }], CREW_HERE)).toBe(3)
    expect(hereCount(undefined, CREW_HERE)).toBe(0)
    expect(hereCount(crewAt().pilots, null)).toBe(0)
    expect(liveLabel(3)).toBe('● Online · 3 here')
    expect(liveLabel(null)).toBe('● Online')
    expect(liveLabel(3, 4)).toBe('● Online · 3 of 4 here')
    // A phone's one-line bar: the count alone, "Online" while there is none.
    expect(liveLabel(3, 4, true)).toBe('● 3 of 4 here')
    expect(liveLabel(null, null, true)).toBe('● Online')
  })
})

describe('read-only, said in one place (play.md §7)', () => {
  test('writes may go: nothing to say', () => {
    expect(playReadOnly({ status: 'live', canWrite: true })).toBeNull()
  })

  test('disconnected and outdated each say so', () => {
    expect(playReadOnly({ status: 'offline', canWrite: false })?.stamp).toBe('Offline · read-only')
    expect(playReadOnly({ status: 'live', canWrite: false, outdated: true })?.stamp).toBe(
      'Read-only · outdated'
    )
    expect(playReadOnly({ status: 'syncing', canWrite: false })?.says).toBe(
      'Read-only while the connection settles.'
    )
  })

  test('signed out, or a server not taking changes, each say so', () => {
    expect(playReadOnly({ status: 'signedOut', canWrite: false })).toEqual({
      stamp: 'Read-only · signed out',
      says: 'Read-only: sign in to play.',
    })
    expect(playReadOnly({ status: 'live', canWrite: false })).toEqual({
      stamp: 'Read-only',
      says: 'Read-only: the server is not taking changes right now.',
    })
  })
})

const roll = (over: Partial<PlayRoll> & { id: string; at: number }): PlayRoll => ({
  tableName: 'Core Mechanic',
  rolls: [14],
  label: 'Core Mechanic',
  outcome: 'Success',
  ...over,
})

describe('the Feed (play.md §8)', () => {
  const proposal: PendingProposal = {
    _id: 'p1' as PendingProposal['_id'],
    entityId: 'bonesaw',
    entityType: 'pilot',
    targetName: 'Bonesaw',
    field: 'currentHP',
    after: 5,
    reason: 'shrapnel',
    ts: 100,
  }
  const crewRoll = (id: string, ts: number, description: string): RollLine => ({
    _id: id,
    ts,
    description,
    actorName: 'Someone',
    source: 'play',
  })
  const alert: AlertLine = { _id: 'a1', message: 'Storm incoming', ts: 250 }

  test('a proposal awaiting my answer is one entry: the table’s line for it waits for the answer (r4 B5)', () => {
    const asked = (ts: number, text: string): TableEvent => ({
      _id: `e${ts}`,
      ts,
      kind: 'proposal',
      text,
      actorId: 'gm',
      about: 'me',
    })
    const events = [
      asked(100, 'Mediator proposes Bonesaw HP → 5'),
      // One already answered, and its answer: both stay.
      asked(50, 'Mediator proposes Bonesaw AP → 2'),
      { ...asked(60, 'Ash accepted: Bonesaw AP → 2'), actorId: 'me' },
    ]
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      events,
      proposals: [proposal],
      mine: [],
      rollerName: 'Bonesaw',
      viewerId: 'me',
    })
    expect(entries.map((e) => [e.kind, e.text])).toEqual([
      ['proposal', 'Mediator proposes Bonesaw HP → 5'],
      ['event', 'You accepted: Bonesaw AP → 2'],
      ['event', 'Mediator proposes Bonesaw AP → 2'],
    ])
  })

  test('one action is one entry: its use and cost fold into its roll; my own change is said once (r5 A9)', () => {
    const ev = (
      id: string,
      ts: number,
      kind: TableEvent['kind'],
      text: string,
      actorId = 'razor'
    ): TableEvent => ({ _id: id, ts, kind, text, actorId })
    const events = [
      ev('e5', 9000, 'vitals', 'Thresher (Razor) · SP 5 → 2', 'gm'),
      ev('e4', 1300, 'roll', 'Razor · Red Laser · 18 · Success'),
      ev('e3', 1200, 'vitals', 'Thresher (Razor) · Heat 0 → 1'),
      ev('e2', 1000, 'action', 'Razor uses Red Laser'),
      ev('e1', 500, 'action', 'Razor uses Provoke'),
      ev('e0', 600, 'vitals', 'Razor · AP 3 → 2'),
      // My own vital, which this screen said with what is due.
      ev('m-v', 2000, 'vitals', 'Hotdog · HP 10 → 0', 'me'),
    ]
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      events,
      proposals: [],
      mine: [
        {
          id: 'm-z',
          at: 2001,
          tableName: '',
          label: 'Hotdog · HP 10→0 · roll on Critical Injury',
          rolls: [],
        },
      ],
      rollerName: 'Hotdog',
      viewerId: 'me',
    })
    expect(entries.map((e) => [e.text, e.lead, e.detail])).toEqual([
      ['Thresher (Razor) · SP 5 → 2', undefined, undefined],
      ['You · Hotdog · HP 10→0 · roll on Critical Injury', undefined, undefined],
      [
        'Razor · Red Laser · 18 · Success',
        'Razor uses Red Laser',
        ['Thresher (Razor) · Heat 0 → 1'],
      ],
      // Nothing rolled: the use is the entry, its cost under it.
      ['Razor uses Provoke', undefined, ['Razor · AP 3 → 2']],
    ])
  })

  test('my own lines all read You, acts as well as rolls, and my use still heads its roll (r7 A5)', () => {
    const ev = (id: string, ts: number, kind: TableEvent['kind'], text: string): TableEvent => ({
      _id: id,
      ts,
      kind,
      text,
      actorId: 'me',
    })
    const own = (e: TableEvent) => tableLine(e, 'me')
    expect(own(ev('t', 1, 'turn', 'Pickle ended their turn'))).toBe('You ended your turn')
    expect(own(ev('b', 1, 'board', 'Pickle boards Spectrum'))).toBe('You board Spectrum')
    expect(own(ev('s', 1, 'action', 'Pickle switches Hull Magnetiser on'))).toBe(
      'You switch Hull Magnetiser on'
    )
    expect(own(ev('n', 1, 'action', 'Pickle · Red Laser: not applied'))).toBe(
      'You · Red Laser: not applied'
    )
    // Someone else's reads as the room words it.
    expect(
      tableLine({ ...ev('o', 1, 'turn', 'Pickle ended their turn'), actorId: 'p2' }, 'me')
    ).toBe('Pickle ended their turn')
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      events: [
        ev('r', 1300, 'roll', 'Pickle · FM-3 Flamethrower · 16 · Success'),
        ev('u', 1000, 'action', 'Pickle uses FM-3 Flamethrower'),
      ],
      proposals: [],
      mine: [],
      rollerName: 'Pickle',
      viewerId: 'me',
    })
    expect(entries.map((e) => [e.text, e.lead])).toEqual([
      ['You · FM-3 Flamethrower · 16 · Success', 'You use FM-3 Flamethrower'],
    ])
  })

  test('proposals awaiting an answer first, then everything newest first', () => {
    const entries = playFeedEntries({
      rolls: [crewRoll('r2', 300, 'Mags · Core Mechanic · 20'), crewRoll('r1', 200, 'Rook · 9')],
      alerts: [alert],
      proposals: [proposal],
      mine: [roll({ id: 'm1', at: 400 }), roll({ id: 'm0', at: 150, label: 'Vent', rolls: [] })],
      rollerName: 'Bonesaw',
    })
    expect(entries.map((e) => [e.kind, e.ts])).toEqual([
      ['proposal', 100],
      ['mine', 400],
      ['roll', 300],
      ['alert', 250],
      ['roll', 200],
      ['mine', 150],
    ])
    const first = entries[0]
    expect(first?.kind === 'proposal' && first.text).toBe('Mediator proposes Bonesaw HP → 5')
    expect(entries[3]?.kind === 'alert' && entries[3].text).toBe('Mediator · Storm incoming')
  })

  test('a proposal reads from and to once the room says what the sheet holds (r2 C7)', () => {
    expect(proposalChange({ field: 'currentHP', after: 0, current: 7 })).toBe('HP 7 → 0')
    expect(proposalChange({ field: 'currentHP', after: 0, current: null })).toBe('HP → 0')
    expect(proposalChange({ field: 'currentHP', after: 0 })).toBe('HP → 0')
    // A wreck's part proposed to a Mech's hold names what it adds (r5 B2).
    expect(proposalChange({ field: 'cargoLots', after: [{ name: 'Mule (Damaged)' }] })).toBe(
      'Cargo → + Mule (Damaged)'
    )
    const [first] = playFeedEntries({
      rolls: [],
      alerts: [],
      proposals: [{ ...proposal, current: 7 }],
      mine: [],
      rollerName: 'Bonesaw',
    })
    expect(first?.kind === 'proposal' && first.text).toBe('Mediator proposes Bonesaw HP 7 → 5')
  })

  test('my roll’s copy on the Game’s log is dropped: the screen’s carries its post state', () => {
    const mine = roll({ id: 'm1', at: 400 })
    const echo = crewRoll('r9', 400, playRollDescription('Bonesaw', mine))
    const entries = playFeedEntries({
      rolls: [echo, crewRoll('r8', 399, 'Mags · Core Mechanic · 14 · Success')],
      alerts: [],
      proposals: [],
      mine: [mine],
      rollerName: 'Bonesaw',
    })
    expect(entries.map((e) => e.key)).toEqual(['m1', 'roll-r8'])
  })

  test('a roll of mine this screen no longer holds still reads "You"', () => {
    const earlier = roll({ id: 'm0', at: 300 })
    const entries = playFeedEntries({
      rolls: [
        crewRoll('r9', 300, playRollDescription('Bonesaw', earlier)),
        crewRoll('r8', 200, 'Mags · Core Mechanic · 14 · Success'),
      ],
      alerts: [],
      proposals: [],
      mine: [],
      rollerName: 'Bonesaw',
    })
    expect(entries.map((e) => e.text)).toEqual([
      'You · Core Mechanic · 14 · Success',
      'Mags · Core Mechanic · 14 · Success',
    ])
  })

  test('a private roll says so, mine and the log’s (the Mediator’s Feed alone is served one)', () => {
    const entries = playFeedEntries({
      rolls: [{ ...crewRoll('r7', 300, 'Mediator · Morale · 4'), private: true }],
      alerts: [],
      proposals: [],
      mine: [{ ...roll({ id: 'm1', at: 400 }), private: true }],
      rollerName: 'Mediator',
    })
    expect(entries.map((e) => e.text)).toEqual([
      'You · Core Mechanic · 14 · Success · Only you',
      'You · Morale · 4 · Only you',
    ])
  })

  test('a veiled roll carries its id for Reveal, on the log’s copy and on mine (r2 B1)', () => {
    const mine = { ...roll({ id: 'm1', at: 400, label: 'Veteran · Rifle' }), veiled: true as const }
    const event = (id: string, ts: number, text: string) => ({
      _id: id,
      ts,
      kind: 'roll' as const,
      text,
      actorId: 'gm',
      veiled: true as const,
    })
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      events: [
        event('e2', 400, playRollDescription('Mediator', mine)),
        event('e1', 300, 'Mediator · Raider · Morale · 4'),
      ],
      proposals: [],
      mine: [mine],
      rollerName: 'Mediator',
    })
    expect(entries.map((e) => [e.kind, 'reveal' in e ? e.reveal : undefined])).toEqual([
      ['mine', 'e2'],
      ['roll', 'e1'],
    ])
  })

  test('a private roll says the players miss all of it; revealed, it stops saying Private and offers no Reveal (r3 A1)', () => {
    const mine = {
      ...roll({ id: 'm1', at: 400, label: 'Warlord Vex · Rifle' }),
      private: true as const,
      veiled: true as const,
    }
    const copy = {
      _id: 'e2',
      ts: 400,
      kind: 'roll' as const,
      text: playRollDescription('Mediator', mine),
      actorId: 'gm',
    }
    const older = {
      _id: 'e1',
      ts: 300,
      kind: 'roll' as const,
      text: 'Mediator · Morale · 4',
      actorId: 'gm',
    }
    const feed = (events: TableEvent[]) =>
      playFeedEntries({
        rolls: null,
        alerts: [],
        events,
        proposals: [],
        mine: [mine],
        rollerName: 'Mediator',
        viewerId: 'gm',
      }).map((e) => [
        e.text,
        'reveal' in e ? e.reveal : undefined,
        'kept' in e ? e.kept : undefined,
      ])
    expect(
      feed([
        { ...copy, private: true, veiled: true },
        { ...older, private: true },
      ])
    ).toEqual([
      ['You · Warlord Vex · Rifle · 14 · Success · Only you', 'e2', 'roll'],
      ['You · Morale · 4 · Only you', 'e1', 'roll'],
    ])
    expect(
      feed([
        { ...copy, revealed: true },
        { ...older, revealed: true },
      ])
    ).toEqual([
      ['You · Warlord Vex · Rifle · 14 · Success', undefined, undefined],
      ['You · Morale · 4', undefined, undefined],
    ])
  })

  test('another Mediator’s roll is never signed You, though this screen rolls as Mediator too (r3 A2)', () => {
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      events: [
        { _id: 'e2', ts: 400, kind: 'roll', text: 'Mediator · Morale · 4', actorId: 'me' },
        {
          _id: 'e1',
          ts: 300,
          kind: 'roll',
          text: 'Old · Vex · Rifle · 3',
          actorId: 'old',
          private: true,
        },
        { _id: 'e0', ts: 200, kind: 'roll', text: 'Mediator · Vex · Rifle · 9', actorId: 'co' },
      ],
      proposals: [],
      mine: [],
      rollerName: 'Mediator',
      viewerId: 'me',
    })
    expect(entries.map((e) => e.text)).toEqual([
      'You · Morale · 4',
      'Old · Vex · Rifle · 3 · Only you',
      'Mediator · Vex · Rifle · 9',
    ])
  })

  test('what the players read of a veiled roll names nothing that rolled (r2 B1)', () => {
    const veteran = roll({ id: 'v', at: 1, rolls: [9], label: 'Veteran · Green Laser Rifle' })
    expect(veiledRollDescription({ ...veteran, outcome: 'Tough Choice' })).toBe(
      'Mediator rolled · 9 · Tough Choice'
    )
    expect(
      rollLogEntry(
        'g1',
        {
          description: 'Mediator · Veteran · 9',
          result: { kind: 'table', roll: 9, outcome: 'Tough Choice' },
          veiled: 'Mediator rolled · 9 · Tough Choice',
        },
        1
      ).after
    ).toMatchObject({ veiled: 'Mediator rolled · 9 · Tough Choice' })
  })

  test('solo: only my own', () => {
    const entries = playFeedEntries({
      rolls: null,
      alerts: [],
      proposals: [],
      mine: [roll({ id: 'm1', at: 1 })],
      rollerName: 'Bonesaw',
    })
    expect(entries.map((e) => e.text)).toEqual(['You · Core Mechanic · 14 · Success'])
  })

  test('a change has no dice: "You · Vent · Heat 6→0, Vulnerable"', () => {
    expect(
      mineText(
        roll({
          id: 'c',
          at: 1,
          label: 'Vent · Heat 6→0, Vulnerable',
          rolls: [],
          outcome: undefined,
        })
      )
    ).toBe('You · Vent · Heat 6→0, Vulnerable')
  })
})

describe('the roll log (playRolls)', () => {
  afterEach(() => clearPlayRolls())

  test('every recorded roll is heard once, with an id and a time', () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((r) => heard.push(r))
    const a = recordPlayRoll({
      tableName: 'Core Mechanic',
      rolls: [7],
      label: 'Core Mechanic',
      at: 5,
    })
    const b = recordPlayChange('Applied · Bonesaw HP → 5')
    stop()
    recordPlayRoll({ tableName: 'Rumour', rolls: [3], label: 'Rumour' })
    expect(heard.map((r) => r.id)).toEqual([a.id, b.id])
    expect(a.at).toBe(5)
    expect(isDiceRoll(a)).toBe(true)
    expect(isDiceRoll(b)).toBe(false)
  })

  test('a roll in a slot replaces the slot’s roll before it (r5 B1)', () => {
    recordPlayRoll({ tableName: 'Mech Salvage', rolls: [6], label: 'Wreck', slot: 'wreck:n1' })
    recordPlayRoll({ tableName: 'Morale', rolls: [3], label: 'Raider' })
    recordPlayRoll({ tableName: 'Mech Salvage', rolls: [12], label: 'Wreck', slot: 'wreck:n1' })
    const { result, unmount } = renderHook(() => usePlayRollLog())
    expect(result.current.map((r) => r.rolls[0])).toEqual([3, 12])
    unmount()
    const logged = rollLogEntry(
      'g1',
      { description: 'd', result: { kind: 'table', roll: 12, outcome: '' }, slot: 'wreck:n1' },
      1
    )
    expect(logged.after).toMatchObject({ slot: 'wreck:n1' })
  })

  test('a reporting roll is recorded once, with every die it read', async () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((r) => heard.push(r))
    const faces = [9, 17]
    const dice = reportingRoll(
      () => faces.shift() ?? 1,
      'Reactor Overload',
      () => ({ label: 'Push', outcome: 'Overheat' })
    )
    dice(20)
    dice(20)
    await Promise.resolve()
    // A Core Mechanic roll with no outcome of its own reports its band.
    reportingRoll(
      () => 14,
      'Core Mechanic',
      () => ({ label: '120mm Cannon' })
    )(20)
    await Promise.resolve()
    stop()
    expect(heard).toHaveLength(2)
    expect(heard[0]).toMatchObject({
      tableName: 'Reactor Overload',
      rolls: [9, 17],
      label: 'Push',
      outcome: 'Overheat',
    })
    expect(heard[1]).toMatchObject({
      tableName: 'Core Mechanic',
      rolls: [14],
      label: '120mm Cannon',
      outcome: 'Success',
    })
  })

  test('with private rolls on, a roll is recorded private; a change never is', () => {
    setPrivateRolls(true)
    expect(recordPlayRoll({ tableName: 'Morale', rolls: [4], label: 'Morale' }).private).toBe(true)
    expect(recordPlayChange('Vent')).not.toHaveProperty('private')
    setPrivateRolls(false)
    expect(recordPlayRoll({ tableName: 'Morale', rolls: [4], label: 'Morale' })).not.toHaveProperty(
      'private'
    )
  })

  test('the Game’s log line: who, what for, the dice, what it came to', () => {
    expect(playRollDescription('Bonesaw', roll({ id: 'x', at: 1, rolls: [3, 17] }))).toBe(
      'Bonesaw · Core Mechanic · 3, 17 · Success'
    )
  })
})

describe('the Tables (play.md §8)', () => {
  test('a fight pins the combat tables; Downtime its own', () => {
    expect(pinnedTables(false)).toEqual([
      'Core Mechanic',
      'Critical Damage',
      'Reactor Overload',
      'Critical Injury',
      'Group Initiative',
    ])
    // An adventure's rumour table is never pinned for every table (False Flag p.8).
    expect(pinnedTables(true)).toEqual(['Core Mechanic', 'Critical Injury'])
  })

  test('boarded in a Bio-Chassis, the fight pins its own Damage and Overload tables', () => {
    expect(pinnedTables(false, 'bio')).toEqual([
      'Core Mechanic',
      'Bio-Chassis Damage Table',
      'Bio-Chassis Overload Table',
      'Critical Injury',
      'Group Initiative',
    ])
    expect(pinnedTables(true, 'bio')).toEqual(['Core Mechanic', 'Critical Injury'])
  })

  test('Find: names holding the query, those starting with it first, at most six', () => {
    const names = ['Reactor Overload', 'Core Mechanic', 'Rumour', 'Rumour Table', 'Critical Damage']
    expect(findTables(names, 'rum')).toEqual(['Rumour', 'Rumour Table'])
    expect(findTables(names, 'o')).toHaveLength(4)
    expect(findTables(names, '  ')).toEqual([])
  })
})

describe('Discord channels (play.md §9)', () => {
  test('the Tables say where rolls post: the channel by name, else whose it is', () => {
    expect(postsToLabel(true)).toBe('Rolls post to my channel')
    expect(postsToLabel(false)).toBe('Rolls post to the Game’s channel')
    const named = { channelId: 'c1', channelName: 'salvage-run', boundAt: 1 }
    expect(postsToLabel(false, named)).toBe('Rolls post to #salvage-run')
    expect(postsToLabel(true, { ...named, channelName: null })).toBe('Rolls post to my channel')
    const own = { ...named, channelName: null, own: true as const }
    expect(postsToLabel(false, own)).toBe('Rolls post to my channel')
  })

  test('the channel control: Discord channel, the channel by name, else whose it is', () => {
    const game = { kind: 'game' as const, gameName: 'Rust Belt Run' }
    const named = { channelId: 'c1', channelName: 'salvage-run', boundAt: 1 }
    expect(channelButtonLabel(game, null)).toBe('Discord channel')
    expect(channelButtonLabel(game, named)).toBe('#salvage-run')
    expect(channelButtonLabel(game, { ...named, channelName: null })).toBe('# Game channel')
    expect(channelButtonLabel({ kind: 'solo' }, { ...named, channelName: null })).toBe(
      '# My channel'
    )
    expect(channelTag(named)).toBe('#salvage-run')
    expect(channelTag(null)).toBeNull()
  })
})

// MD2-12: one Feed called the Mediator 'You', 'Mediator' and 'Crewmate'.
describe('the Mediator on the Feed', () => {
  const event = (
    kind: 'alert' | 'proposal' | 'session' | 'join' | 'downtime' | 'role' | 'stop' | 'leave',
    text: string,
    actorId: string,
    over: Partial<TableEvent> = {}
  ): TableEvent => ({ _id: text, ts: 1, kind, text, actorId, ...over })
  const lines = (viewerId: string) =>
    playFeedEntries({
      rolls: null,
      alerts: [],
      proposals: [],
      mine: [],
      rollerName: 'Med',
      viewerId,
      events: [
        event('alert', 'Mediator · Dust on the ridge', 'med'),
        event('proposal', 'Mediator proposes Bonesaw HP → 5', 'med'),
        event('session', 'Mediator started the group session', 'med'),
        event('proposal', 'Nell accepted: Bonesaw HP → 5', 'nell'),
      ],
    }).map((e) => e.text)

  test('their own screen says You; everyone else’s says Mediator', () => {
    expect(lines('med')).toEqual([
      'You · Dust on the ridge',
      'You propose Bonesaw HP → 5',
      'You started the group session',
      'Nell accepted: Bonesaw HP → 5',
    ])
    expect(lines('nell').slice(0, 3)).toEqual([
      'Mediator · Dust on the ridge',
      'Mediator proposes Bonesaw HP → 5',
      'Mediator started the group session',
    ])
  })

  test('Downtime, the role and my own answer are named like every other line (r3 A6)', () => {
    const events = [
      event('downtime', 'Mediator began Downtime', 'med'),
      event('downtime', 'Mediator ended Downtime', 'med'),
      event('role', 'Crewmate now mediates this Game', 'org', { about: 'med' }),
      event('proposal', 'Crewmate accepted: Bonesaw HP → 5', 'nell', { answer: 'accepted' }),
      event('proposal', 'Crewmate undid: Bonesaw HP → 5', 'nell', { answer: 'undone' }),
      event('join', 'Crewmate joined the Game', 'nell'),
    ]
    expect(events.map((e) => tableLine(e, 'med'))).toEqual([
      'You began Downtime',
      'You ended Downtime',
      'You now mediate this Game',
      'Crewmate accepted: Bonesaw HP → 5',
      'Crewmate undid: Bonesaw HP → 5',
      'Crewmate joined the Game',
    ])
    expect(events.map((e) => tableLine(e, 'nell'))).toEqual([
      'Mediator began Downtime',
      'Mediator ended Downtime',
      'Crewmate now mediates this Game',
      'You accepted: Bonesaw HP → 5',
      'You undid: Bonesaw HP → 5',
      'You joined the Game',
    ])
    // A Mediator's roll on a list that knows no roller's name ("Last session").
    const rolled = {
      _id: 'r',
      ts: 1,
      kind: 'roll' as const,
      text: 'Mediator · Morale · 4',
      actorId: 'med',
    }
    expect(tableLine(rolled, 'med')).toBe('You · Morale · 4')
    expect(tableLine(rolled, 'nell')).toBe('Mediator · Morale · 4')
  })

  test('the Stop Sign lifted and a removal read You on your own screen (r6 A9)', () => {
    const lifted = event('stop', 'Nell lifted the Stop Sign. Play resumes.', 'nell')
    expect(tableLine(lifted, 'nell')).toBe('You lifted the Stop Sign. Play resumes.')
    expect(tableLine(lifted, 'med')).toBe('Nell lifted the Stop Sign. Play resumes.')
    const removed = event('leave', 'Nell was removed from the Game', 'org', { about: 'nell' })
    expect(tableLine(removed, 'nell')).toBe('You were removed from the Game')
    expect(tableLine(removed, 'med')).toBe('Nell was removed from the Game')
  })
})
