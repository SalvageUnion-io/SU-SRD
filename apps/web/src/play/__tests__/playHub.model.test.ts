import { describe, expect, test } from 'bun:test'
import type { CrewSources } from '../playHub.model'
import { gameChips, gameCrew, gameDoors, pairedCrew } from '../playHub.model'

/** The Play hub's Your Games: a Game's Compact, its chips and its doors (ADR-052 §4). */

const GAME = { _id: 'g1', name: 'The Rust Belt Run', mediator: false }

describe('its chips', () => {
  test('Session live follows your role while a group session runs', () => {
    expect(
      gameChips({ mediator: false, live: true, here: 0, downtime: undefined }).map((c) => c.label)
    ).toEqual(['Player', 'Session live'])
  })

  test('your role, how many are here, and the Downtime step', () => {
    expect(
      gameChips({ mediator: false, here: 3, downtime: { running: true, stepIndex: 3 } })
    ).toEqual([
      { key: 'role', label: 'Player' },
      { key: 'here', label: '3 here' },
      { key: 'downtime', label: 'Downtime', value: 'Step 4' },
    ])
  })

  test('nobody here and no Downtime: the role alone', () => {
    expect(
      gameChips({ mediator: true, here: 0, downtime: { running: false, stepIndex: null } })
    ).toEqual([{ key: 'role', label: 'Mediator' }])
    expect(gameChips({ mediator: true, here: 0, downtime: undefined })).toEqual([
      { key: 'role', label: 'Mediator' },
    ])
  })

  test('a Downtime with no step yet is named alone', () => {
    expect(
      gameChips({ mediator: false, here: 0, downtime: { running: true, stepIndex: null } })[1]
    ).toEqual({ key: 'downtime', label: 'Downtime' })
  })
})

describe('its doors', () => {
  const MEDIATE = {
    label: 'Mediate',
    href: '/play/games/g1/mediate',
    ariaLabel: 'Mediate The Rust Belt Run',
  }
  const BONESAW = {
    label: 'Play Bonesaw',
    href: '/play/pilots/p1',
    ariaLabel: 'Play Bonesaw in The Rust Belt Run',
  }

  const START = {
    label: 'Start session',
    href: '/play/games/g1/mediate',
    ariaLabel: 'Start a group session of The Rust Belt Run',
    start: true,
  }

  test('a Mediator who also plays gets their door, then their pilot', () => {
    expect(gameDoors({ ...GAME, mediator: true }, [{ id: 'p1', name: 'Bonesaw' }], false)).toEqual([
      START,
      BONESAW,
    ])
    // Before the room answers, Mediate: never a Start that cannot be pressed.
    expect(gameDoors({ ...GAME, mediator: true }, [{ id: 'p1', name: 'Bonesaw' }])).toEqual([
      MEDIATE,
      BONESAW,
    ])
  })

  test('a Mediator with no pilot there gets their door alone', () => {
    expect(gameDoors({ ...GAME, mediator: true }, [], true)).toEqual([MEDIATE])
  })

  test('a player gets a door for every pilot of theirs', () => {
    expect(
      gameDoors(GAME, [
        { id: 'p1', name: 'Bonesaw' },
        { id: 'p2', name: 'Driftwood' },
      ])
    ).toEqual([
      BONESAW,
      {
        label: 'Play Driftwood',
        href: '/play/pilots/p2',
        ariaLabel: 'Play Driftwood in The Rust Belt Run',
      },
    ])
  })

  test('none with no pilot of yours there', () => {
    expect(gameDoors(GAME, [])).toEqual([])
  })

  test('once a session is live: Mediate, and each pilot joins it', () => {
    expect(gameDoors({ ...GAME, mediator: true }, [{ id: 'p1', name: 'Bonesaw' }], true)).toEqual([
      MEDIATE,
      {
        label: 'Join as Bonesaw',
        href: '/play/pilots/p1',
        ariaLabel: 'Join the session in The Rust Belt Run as Bonesaw',
      },
    ])
  })
})

describe('its crew', () => {
  type Pilot = CrewSources['pilots'][number]
  type Mech = CrewSources['mechs'][number]
  const pilot = (over: Record<string, unknown>): Pilot =>
    ({
      _id: 'p1',
      linkId: 'a-p1',
      appId: 'a-p1',
      ownerId: 'u1',
      name: 'Rook',
      currentHP: null,
      maxHP: 10,
      currentAP: null,
      maxAP: 5,
      boarded: false,
      mechId: null,
      ...over,
    }) as Pilot
  const mech = (over: Record<string, unknown>): Mech =>
    ({
      _id: 'm1',
      linkId: 'a-m1',
      appId: 'a-m1',
      ownerId: 'u1',
      name: 'Spectrum',
      currentSP: 6,
      maxSP: 9,
      currentEP: null,
      maxEP: 5,
      currentHeat: 0,
      maxHeat: 9,
      ...over,
    }) as Mech
  const crawler = (id: string, name: string) => ({ _id: id, appId: `a-${id}`, body: { name } })

  test('the primary crawler first, then each pilot paired with its mech, then spare mechs', () => {
    const crew = gameCrew({
      crawlers: [crawler('c2', 'Second Wind'), crawler('c1', 'Big Sal')],
      primaryCrawlerId: 'c1',
      pilots: [
        pilot({ boarded: true, mechId: 'a-m1' }),
        pilot({ _id: 'p2', linkId: 'a-p2', name: 'Vesper' }),
      ],
      mechs: [mech({}), mech({ _id: 'm2', linkId: 'a-m2', name: 'Thresher' })],
    })
    expect(crew.map((u) => [u.kind, u.name])).toEqual([
      ['crawler', 'Big Sal'],
      ['crawler', 'Second Wind'],
      ['mech', 'Spectrum'],
      ['pilot', 'Vesper'],
      ['mech', 'Thresher'],
    ])
    expect(crew[2]?.readings).toEqual([
      { label: 'SP', value: '6/9' },
      { label: 'EP', value: '5/5' },
      { label: 'Heat', value: '0/9' },
    ])
    expect(crew[2]?.relations?.[0]?.param).toBe('Rook')
    expect(crew[3]?.href).toBe('/pilots/a-p2')
  })

  test('a member’s own: each unit carries whose it is', () => {
    const crew = pairedCrew({
      pilots: [pilot({ mechId: 'a-m1' })],
      mechs: [mech({}), mech({ _id: 'm3', linkId: 'a-m3', ownerId: 'u2', name: 'Kite' })],
    })
    expect(crew.map((c) => [c.ownerId, c.unit.name])).toEqual([
      ['u1', 'Rook'],
      ['u2', 'Kite'],
    ])
  })
})

describe('its channel chip', () => {
  test('a bound channel lists last, by its name', () => {
    expect(
      gameChips({ mediator: true, here: 0, downtime: undefined, channel: '#salvage-run' })
    ).toEqual([
      { key: 'role', label: 'Mediator' },
      { key: 'channel', label: '#salvage-run' },
    ])
  })
})
