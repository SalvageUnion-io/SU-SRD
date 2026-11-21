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
    expect(texts()).toEqual(['p1 · Pilot p1 · HP → 6'])
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
    expect(texts()).toEqual(['p1 · Pilot p1 · HP 8 → 5', 'p1 · Pilot p1 · HP → 8'])
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
    expect(mediators.filter((e) => isMirrored(e))).toEqual([])
    expect(room.events.list(STRANGER)).toEqual([])
  })
})
