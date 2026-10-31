/**
 * The right column's pure models (play.md §7–§9): the Crew's lines and the
 * LIVE stamp's "N here", the Feed's one list, the pinned tables, the landing's
 * channel rows, the read-only words and the roll log.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { channelButtonLabel, channelTag, postLabel } from '../channels.model'
import { crewLineLabel, crewSeatLines, hereCount, pairedMech } from '../crew.model'
import { mineText, playFeedEntries } from '../feed.model'
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
} from '../playRolls.model'
import { findTables, pinnedTables } from '../tables.model'
import type { AlertLine, PendingProposal, RollLine } from '../useGameFeed'
import { CREW_HERE, crewAt } from './crewFixture'

describe('the Crew (play.md §7)', () => {
  const lines = crewSeatLines(crewAt(), [], 'bonesaw', CREW_HERE)

  test('one line per other seat: the pilot this screen plays is left out', () => {
    expect(lines.map((l) => l.name)).toEqual(['Mags', 'Rook', 'Wren'])
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

  test('the line’s words for a screen reader say all of it', () => {
    expect(lines.map(crewLineLabel)).toEqual([
      'Mags, here, Boarded · Atlas, SP 22, fine',
      'Rook, here, On foot, Injured',
      'Wren, away, Boarded · Mule, SP 26, fine',
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
    ])
    expect(pinnedTables(true)).toEqual(['Core Mechanic', 'Critical Injury', 'Rumour'])
  })

  test('boarded in a Bio-Chassis, the fight pins its own Damage and Overload tables', () => {
    expect(pinnedTables(false, 'bio')).toEqual([
      'Core Mechanic',
      'Bio-Chassis Damage Table',
      'Bio-Chassis Overload Table',
      'Critical Injury',
    ])
    expect(pinnedTables(true, 'bio')).toEqual(['Core Mechanic', 'Critical Injury', 'Rumour'])
  })

  test('Find: names holding the query, those starting with it first, at most six', () => {
    const names = ['Reactor Overload', 'Core Mechanic', 'Rumour', 'Rumour Table', 'Critical Damage']
    expect(findTables(names, 'rum')).toEqual(['Rumour', 'Rumour Table'])
    expect(findTables(names, 'o')).toHaveLength(4)
    expect(findTables(names, '  ')).toEqual([])
  })
})

describe('Discord channels (play.md §9)', () => {
  test('the Post toggle says where: the channel by name, else whose it is', () => {
    expect(postLabel(true)).toBe('Post rolls to my channel')
    expect(postLabel(false)).toBe('Post rolls to the Game’s channel')
    const named = { channelId: 'c1', channelName: 'salvage-run', boundAt: 1 }
    expect(postLabel(false, named)).toBe('Post rolls to #salvage-run')
    expect(postLabel(true, { ...named, channelName: null })).toBe('Post rolls to my channel')
  })

  test('the channel button: Connect, the channel by name, else whose it is', () => {
    const game = { kind: 'game' as const, gameName: 'Rust Belt Run' }
    const named = { channelId: 'c1', channelName: 'salvage-run', boundAt: 1 }
    expect(channelButtonLabel(game, null)).toBe('Connect')
    expect(channelButtonLabel(game, named)).toBe('#salvage-run')
    expect(channelButtonLabel(game, { ...named, channelName: null })).toBe('# Game channel')
    expect(channelButtonLabel({ kind: 'solo' }, { ...named, channelName: null })).toBe(
      '# My channel'
    )
    expect(channelTag(named)).toBe('#salvage-run')
    expect(channelTag(null)).toBeNull()
  })
})
