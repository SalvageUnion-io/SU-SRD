import { describe, expect, test } from 'bun:test'
import type { GameActArgs, GameActName } from '../acts'
import { runAct } from '../acts'
import { isMirrored, MERGE_MS } from '../events'
import { AT, bodies, MEDIATOR, op, PLAYER, STRANGER, table } from './harness'

/** A table with PLAYER's pilot and mech, and acts run as the room's Durable Object runs them. */
function seated() {
  const made = table()
  const { room, gameId } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  const act = <N extends GameActName>(actor: string, name: N, args: GameActArgs<N>, at = AT) => {
    const before = room.events.before(name, args)
    const answer = runAct({ room, actor, gameId, at }, name, args)
    if (!answer.ok) throw new Error(answer.refusal)
    return room.events.after(actor, name, args, answer.value, before, at)
  }
  const texts = (actor = PLAYER) => room.events.list(actor).map((e) => e.text)
  return { ...made, act, texts }
}

describe('the table’s events', () => {
  test('a vital’s change is one line naming the unit, from and to', () => {
    const { act, texts } = seated()
    const [event] = act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 6 })] })
    expect(event).toMatchObject({ kind: 'vitals', actorId: PLAYER })
    expect(texts()).toEqual(['p1 · Pilot p1 · HP 10 → 6'])
  })

  test('rapid repeats on one vital merge into the line they follow, keeping where it began', () => {
    const { act, texts, room } = seated()
    act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 8 })] }, AT)
    const first = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 7 }, { baseSeq: 1 })] },
      AT + 60_000
    )
    const second = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 6 }, { baseSeq: 2 })] },
      AT + 61_000
    )
    const third = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 5 }, { baseSeq: 3 })] },
      AT + 62_000
    )
    expect(second[0]?._id).toBe(first[0]?._id as string)
    expect(third[0]?.text).toBe('p1 · Pilot p1 · HP 8 → 5')
    expect(texts()).toEqual(['p1 · Pilot p1 · HP 8 → 5', 'p1 · Pilot p1 · HP 10 → 8'])
    // Past the window, or once the line is sealed (posted), a change starts a new line.
    act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 4 }, { baseSeq: 4 })] },
      AT + 62_000 + MERGE_MS + 1
    )
    expect(texts()[0]).toBe('p1 · Pilot p1 · HP 5 → 4')
    room.events.seal()
    act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 3 }, { baseSeq: 5 })] },
      AT + 62_000 + MERGE_MS + 2
    )
    expect(texts()[0]).toBe('p1 · Pilot p1 · HP 4 → 3')
    expect(texts()).toHaveLength(4)
  })

  test('a vital never written reads its start: a pool its maximum, Heat 0 (L10)', () => {
    const { act, texts } = seated()
    act(PLAYER, 'submit', { ops: [op('m1', { currentHeat: 2 })] })
    act(PLAYER, 'submit', { ops: [op('m1', { currentSP: 3 }, { baseSeq: 1 })] }, AT + 1)
    const [sp, heat] = texts()
    expect(heat).toBe('Mech m1 · Heat 0 → 2')
    expect(sp).toMatch(/^Mech m1 · SP \d+ → 3$/)
  })

  test('an effect switched on or off, and a system damaged or repaired, each say so (L10)', () => {
    const { act, texts } = seated()
    act(PLAYER, 'seats.board', { pilotId: 'p1', mechId: 'm1' }, AT + 1)
    act(PLAYER, 'seats.toggleEffect', { pilotId: 'p1', ref: 'hull-magnetiser' }, AT + 2)
    act(PLAYER, 'seats.toggleEffect', { pilotId: 'p1', ref: 'hull-magnetiser' }, AT + 3)
    act(
      PLAYER,
      'submit',
      { ops: [op('m1', { systemConditions: { '50-cal-machine-gun': 'damaged' } })] },
      AT + 4
    )
    const [repaired] = act(
      PLAYER,
      'submit',
      {
        ops: [
          op(
            'm1',
            { systemConditions: { '50-cal-machine-gun': 'intact' }, moduleConditions: {} },
            { baseSeq: 1 }
          ),
        ],
      },
      AT + 5
    )
    expect(repaired).toMatchObject({ kind: 'vitals', actorId: PLAYER })
    expect(texts().slice(0, 4)).toEqual([
      'Mech m1 · .50 Cal Machine Gun is repaired',
      'Mech m1 · .50 Cal Machine Gun is damaged',
      'p1 · Pilot p1 switches Hull Magnetiser off',
      'p1 · Pilot p1 switches Hull Magnetiser on',
    ])
  })

  test('boarding, an action, the session, a proposal and joining each say themselves', () => {
    const { act, texts, room, code } = seated()
    act(PLAYER, 'seats.board', { pilotId: 'p1', mechId: 'm1' }, AT + 1)
    const using = { ref: 'a', name: 'Patch', activated: false, applied: false }
    act(PLAYER, 'seats.setResolving', { pilotId: 'p1', resolving: using }, AT + 2)
    // The same resolve moving on is not a second use.
    expect(
      act(
        PLAYER,
        'seats.setResolving',
        { pilotId: 'p1', resolving: { ...using, activated: true } },
        AT + 3
      )
    ).toEqual([])
    act(MEDIATOR, 'session.start', undefined as never, AT + 4)
    const id = room.newId()
    void id
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentAP', after: 2 }, AT + 5)
    const pending = room.proposals.pending(PLAYER)[0]
    act(PLAYER, 'ops.accept', { opId: pending?._id as string }, AT + 6)
    act(MEDIATOR, 'session.end', undefined as never, AT + 7)
    act(STRANGER, 'redeem', { code, profile: { displayName: 'Nell', avatarUrl: null } }, AT + 8)
    expect(texts()).toEqual([
      'Nell joined the Game',
      'Med ended the group session',
      'Player accepted: p1 · Pilot p1 AP → 2',
      'Mediator proposes p1 · Pilot p1 AP → 2',
      'Med started the group session',
      'p1 · Pilot p1 uses Patch',
      'p1 · Pilot p1 boards Mech m1',
    ])
  })

  test('an assignment taken away says whose it was, so their screen says it once (MD-23)', () => {
    const { act } = seated()
    const [unassigned] = act(MEDIATOR, 'unassign', { unitId: 'p1' }, AT + 1)
    expect(unassigned).toMatchObject({ kind: 'assign', text: 'p1 · Pilot p1 is unassigned' })
    expect(unassigned?.about).toBe(PLAYER)
    // Nobody held it: nobody to tell.
    const [given] = act(MEDIATOR, 'assign', { unitId: 'p1', userId: PLAYER }, AT + 2)
    expect(given?.about).toBeUndefined()
    const [moved] = act(MEDIATOR, 'assign', { unitId: 'p1', userId: MEDIATOR }, AT + 3)
    expect(moved?.about).toBe(PLAYER)
  })

  test('climbing out and ejecting each say so', () => {
    const { act, texts } = seated()
    act(PLAYER, 'seats.board', { pilotId: 'p1', mechId: 'm1' }, AT + 1)
    act(PLAYER, 'seats.dismount', { pilotId: 'p1' }, AT + 2)
    // Past the merge window, so boarding again is its own line.
    act(PLAYER, 'seats.board', { pilotId: 'p1', mechId: 'm1' }, AT + MERGE_MS + 3)
    act(PLAYER, 'seats.eject', { pilotId: 'p1' }, AT + MERGE_MS + 4)
    expect(texts().slice(0, 3)).toEqual([
      'p1 · Pilot p1 ejects',
      'p1 · Pilot p1 boards Mech m1',
      'p1 · Pilot p1 climbs out, on foot',
    ])
  })

  test('the same line said again at once is counted on the line it follows, not repeated', () => {
    const { act, texts } = seated()
    const [first] = act(MEDIATOR, 'assign', { unitId: 'p1', userId: PLAYER }, AT + 1)
    const [again] = act(MEDIATOR, 'assign', { unitId: 'p1', userId: PLAYER }, AT + 2)
    const [third] = act(MEDIATOR, 'assign', { unitId: 'p1', userId: PLAYER }, AT + 3)
    expect(again?._id).toBe(first?._id as string)
    expect(again?.text).toBe('p1 · Pilot p1 is assigned to Player ×2')
    expect(third?.text).toBe('p1 · Pilot p1 is assigned to Player ×3')
    expect(texts()).toEqual(['p1 · Pilot p1 is assigned to Player ×3'])
  })

  test('a session already running, or none to end, and a Stop Sign already up or not up, say nothing', () => {
    const { act, texts } = seated()
    expect(act(MEDIATOR, 'session.end', undefined as never, AT + 1)).toEqual([])
    act(MEDIATOR, 'session.start', undefined as never, AT + 2)
    expect(act(MEDIATOR, 'session.start', undefined as never, AT + 3)).toEqual([])
    expect(act(MEDIATOR, 'safety.liftStop', undefined as never, AT + 4)).toEqual([])
    act(PLAYER, 'safety.showStop', undefined as never, AT + 5)
    expect(act(MEDIATOR, 'safety.showStop', undefined as never, AT + 6)).toEqual([])
    expect(texts()).toEqual([
      'The Stop Sign is up. Play is paused.',
      'Med started the group session',
    ])
  })

  test('the Stop Sign names nobody, and only its lifting is mirrored as a line', () => {
    const { act } = seated()
    const [up] = act(PLAYER, 'safety.showStop', undefined as never)
    expect(up).toMatchObject({ kind: 'stop', actorId: null })
    expect(isMirrored(up as never)).toBe(false)
    const [down] = act(MEDIATOR, 'safety.liftStop', undefined as never, AT + 1)
    expect(down?.actorId).toBeNull()
    expect(isMirrored(down as never)).toBe(true)
  })

  test('rolls and alerts are part of the one stream; a private roll is the Mediators’ only and never mirrored', () => {
    const { room, texts } = seated()
    const roll = (description: string, extra: object, ts: number) => ({
      entityType: 'game',
      field: 'roll',
      after: { description, ...extra },
      source: 'play',
      ts,
    })
    room.log.append(PLAYER, [roll('p1 · Core Mechanic · 14 · Success', {}, AT + 1)])
    room.log.append(MEDIATOR, [roll('Mediator · Morale · 3', { private: true }, AT + 2)])
    room.log.broadcast(MEDIATOR, 'Raiders close in', AT + 3)
    expect(texts(PLAYER)).toEqual([
      'Mediator · Raiders close in',
      'p1 · Core Mechanic · 14 · Success',
    ])
    const mediators = room.events.list(MEDIATOR)
    expect(mediators.map((e) => e.kind)).toEqual(['alert', 'roll', 'roll'])
    // A Mediator's roll says whose it is: a player's screen toasts those alone (r2 C4).
    expect(room.events.list(PLAYER).map((e) => e.mediator)).toEqual([undefined, undefined])
    expect(mediators.map((e) => e.mediator)).toEqual([undefined, true, undefined])
    expect(mediators.filter((e) => isMirrored(e))).toEqual([])
    expect(room.events.list(STRANGER)).toEqual([])
  })

  test('an Opposition roll reaches players without its names, in the Feed and the log, until the Mediator reveals it (r2 B1)', () => {
    const { room, act, texts } = seated()
    const full = 'Mediator · Veteran · Green Laser Rifle (Veteran) · 9 · Tough Choice'
    const veiled = 'Mediator rolled · 9 · Tough Choice'
    room.log.append(MEDIATOR, [
      {
        entityType: 'game',
        field: 'roll',
        after: { description: full, veiled },
        source: 'play',
        ts: AT + 1,
      },
    ])
    // The room withholds the names: nothing a player is served carries them.
    expect(texts(PLAYER)).toEqual([veiled])
    expect(JSON.stringify(room.events.list(PLAYER))).not.toContain('Veteran')
    expect(room.log.rolls(PLAYER).map((r) => r.description)).toEqual([veiled])
    expect(room.events.list(PLAYER)[0]).not.toHaveProperty('veiled')
    // The Mediator reads the whole line, marked as one the players do not.
    const [own] = room.events.list(MEDIATOR)
    expect(own).toMatchObject({ text: full, veiled: true })
    expect(room.log.rolls(MEDIATOR)[0]).toMatchObject({ description: full, veiled: true })
    // Only a Mediator reveals, and a revealed roll reads whole to the table.
    expect(() => act(PLAYER, 'changeLog.reveal', { rollId: String(own?._id) })).toThrow(
      'Only the Mediator'
    )
    const told = act(MEDIATOR, 'changeLog.reveal', { rollId: String(own?._id) }, AT + 2)
    expect(told).toMatchObject([{ _id: own?._id, kind: 'roll', text: full }])
    expect(texts(PLAYER)).toEqual([full])
    expect(room.log.rolls(PLAYER).map((r) => r.description)).toEqual([full])
    expect(room.events.list(MEDIATOR)[0]).not.toHaveProperty('veiled')
  })

  test('a player’s roll is never veiled, whatever the client sent (r2 B1)', () => {
    const { room, texts } = seated()
    room.log.append(PLAYER, [
      {
        entityType: 'game',
        field: 'roll',
        after: { description: 'p1 · Core Mechanic · 14 · Success', veiled: 'Mediator rolled' },
        source: 'play',
        ts: AT + 1,
      },
    ])
    expect(texts(MEDIATOR)).toEqual(['p1 · Core Mechanic · 14 · Success'])
    expect(room.events.list(MEDIATOR)[0]).not.toHaveProperty('veiled')
  })

  test('Downtime beginning and ending are each one line for everyone (r2 E2)', () => {
    const { act, texts } = seated()
    const [began] = act(MEDIATOR, 'downtime.begin', undefined as never, AT + 1)
    expect(began).toMatchObject({ kind: 'downtime', actorId: MEDIATOR })
    // A second press while it runs began nothing, and says nothing.
    expect(act(MEDIATOR, 'downtime.begin', undefined as never, AT + 2)).toEqual([])
    const [ended] = act(MEDIATOR, 'downtime.end', undefined as never, AT + 3)
    expect(ended?.kind).toBe('downtime')
    expect(act(MEDIATOR, 'downtime.end', undefined as never, AT + 4)).toEqual([])
    expect(texts(PLAYER)).toEqual(['Med ended Downtime', 'Med began Downtime'])
    expect(isMirrored(began as never)).toBe(true)
  })

  test('Up now clears when the session ends and when Downtime begins (r2 E1)', () => {
    const { act, room } = seated()
    act(MEDIATOR, 'session.start', undefined as never, AT)
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 1)
    expect(room.scene.scene(PLAYER).upNow).toBe('p1')
    act(MEDIATOR, 'session.end', undefined as never, AT + 2)
    expect(room.scene.scene(PLAYER)).not.toHaveProperty('upNow')
    expect(room.scene.updatedAt('scene')).toBe(AT + 2)
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 3)
    act(MEDIATOR, 'downtime.begin', undefined as never, AT + 4)
    expect(room.scene.scene(PLAYER)).not.toHaveProperty('upNow')
  })
})
