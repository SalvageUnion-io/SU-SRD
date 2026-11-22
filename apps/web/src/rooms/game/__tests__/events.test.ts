import { describe, expect, test } from 'bun:test'
import { downtimeStepNames } from 'game-domain/rules/downtime'
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
  test('a Mediator appointed is a line about them; standing one down says nothing (r2 B3)', () => {
    const { act } = seated()
    const [event] = act('d-org', 'setMediator', { userId: PLAYER, mediator: true })
    expect(event).toMatchObject({
      kind: 'role',
      text: 'Player now mediates this Game',
      actorId: 'd-org',
      about: PLAYER,
    })
    expect(act('d-org', 'setMediator', { userId: MEDIATOR, mediator: false })).toEqual([])
  })

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

  test('separate hits stay separate lines: only a − / + nudge folds into the line before it (r2 I3)', () => {
    const { act, texts } = seated()
    const hp = (to: number, baseSeq: number, at: number) =>
      act(PLAYER, 'submit', { ops: [op('p1', { currentHP: to }, { baseSeq })] }, at)
    hp(10, 0, AT)
    // Two hits a second apart: 3, then a mistaken 7.
    const first = hp(7, 1, AT + 60_000)
    const second = hp(0, 2, AT + 61_000)
    expect(second[0]?._id).not.toBe(first[0]?._id as string)
    expect(texts().slice(0, 2)).toEqual(['p1 · Pilot p1 · HP 7 → 0', 'p1 · Pilot p1 · HP 10 → 7'])
    // A nudge after a hit starts its own line, and the next nudge folds into that one.
    hp(1, 3, AT + 62_000)
    hp(2, 4, AT + 63_000)
    expect(texts().slice(0, 3)).toEqual([
      'p1 · Pilot p1 · HP 0 → 2',
      'p1 · Pilot p1 · HP 7 → 0',
      'p1 · Pilot p1 · HP 10 → 7',
    ])
    // A hit between nudges ends the nudged line: the nudge after it is a new one.
    hp(6, 5, AT + 64_000)
    hp(5, 6, AT + 65_000)
    expect(texts().slice(0, 3)).toEqual([
      'p1 · Pilot p1 · HP 6 → 5',
      'p1 · Pilot p1 · HP 2 → 6',
      'p1 · Pilot p1 · HP 0 → 2',
    ])
  })

  test('a change Undo wrote says so, and no nudge folds into it (r3 B2)', () => {
    const { act, texts } = seated()
    const hp = (to: number, baseSeq: number, at: number, source = 'play') =>
      act(PLAYER, 'submit', { ops: [op('p1', { currentHP: to }, { baseSeq, source })] }, at)
    hp(7, 0, AT)
    hp(0, 1, AT + 1_000)
    // Undo writes the value before the last change, and its line is marked.
    const [undone] = hp(7, 2, AT + 2_000, 'play-undo')
    expect(undone?.text).toBe('p1 · Pilot p1 · HP 0 → 7 · Undo')
    // A nudge taken back is a line of its own too, never folded into the nudge.
    hp(6, 3, AT + 3_000)
    hp(7, 4, AT + 4_000, 'play-undo')
    hp(6, 5, AT + 5_000)
    expect(texts().slice(0, 4)).toEqual([
      'p1 · Pilot p1 · HP 7 → 6',
      'p1 · Pilot p1 · HP 6 → 7 · Undo',
      'p1 · Pilot p1 · HP 7 → 6',
      'p1 · Pilot p1 · HP 0 → 7 · Undo',
    ])
  })

  test('a mech’s line names its pilot: whoever is aboard, else whoever it is assigned to (r3 B2)', () => {
    const { act, texts, room } = seated()
    act(PLAYER, 'submit', { ops: [op('m1', { currentHeat: 1 })] }, AT)
    expect(texts()[0]).toBe('Mech m1 · Heat 0 → 1')
    room.units.drawLink(PLAYER, {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
    })
    act(PLAYER, 'submit', { ops: [op('m1', { currentHeat: 3 }, { baseSeq: 1 })] }, AT + 1)
    expect(texts()[0]).toBe('Mech m1 (p1) · Heat 1 → 3')
    room.units.create(PLAYER, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT })
    act(PLAYER, 'seats.board', { pilotId: 'p2', mechId: 'm1' }, AT + 2)
    act(PLAYER, 'submit', { ops: [op('m1', { currentHeat: 5 }, { baseSeq: 2 })] }, AT + 3)
    expect(texts()[0]).toBe('Mech m1 (p2) · Heat 3 → 5')
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
      'Mech m1 (p1) · .50 Cal Machine Gun is repaired',
      'Mech m1 (p1) · .50 Cal Machine Gun is damaged',
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
      // Left resolving when the session ended (r5 A7).
      'p1 · Pilot p1 · Patch: not applied',
      'Mediator ended the group session',
      'Player accepted: p1 · Pilot p1 AP → 2',
      'Mediator proposes p1 · Pilot p1 AP → 2',
      'Mediator started the group session',
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

  test('a pilot paired with a mech flies it: the Feed keeps "assigned to" for a person (r5 B14)', () => {
    const { act, texts } = seated()
    const link = {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
    } as const
    act(PLAYER, 'drawLink', { link }, AT + 1)
    act(PLAYER, 'removeLink', { link }, AT + MERGE_MS + 2)
    expect(texts().slice(0, 2)).toEqual([
      'p1 · Pilot p1 no longer flies Mech m1',
      'p1 · Pilot p1 flies Mech m1',
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
      'Mediator started the group session',
    ])
  })

  test('the Stop Sign names nobody, and only its lifting is mirrored as a line', () => {
    const { act } = seated()
    const [up] = act(PLAYER, 'safety.showStop', undefined as never)
    expect(up).toMatchObject({ kind: 'stop', actorId: null })
    expect(isMirrored(up as never)).toBe(false)
    // Lifted by its own shower: nobody named.
    const [own] = act(PLAYER, 'safety.liftStop', undefined as never, AT + 1)
    expect(own).toMatchObject({ actorId: null, text: 'The Stop Sign is lifted. Play resumes.' })
    expect(isMirrored(own as never)).toBe(true)
    // Lifted by the Mediator for someone else: the Feed says who lifted it (r5 A8).
    act(PLAYER, 'safety.showStop', undefined as never, AT + 2)
    const [down] = act(MEDIATOR, 'safety.liftStop', undefined as never, AT + 3)
    expect(down).toMatchObject({
      actorId: MEDIATOR,
      text: 'Med lifted the Stop Sign. Play resumes.',
    })
    expect(down?.about).toBeUndefined()
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

  test('a Mediator’s roll in a slot replaces the one before it on the Feed; a player’s never does (r5 B1)', () => {
    const { room, texts } = seated()
    const roll = (description: string, ts: number, slot = 'wreck:n1') => ({
      entityType: 'game',
      field: 'roll',
      after: { description, slot },
      source: 'play',
      ts,
    })
    room.log.append(MEDIATOR, [roll('Mediator · Mech Salvage · 6', AT + 1)])
    room.log.append(MEDIATOR, [roll('Mediator · Mech Salvage · 12', AT + 2)])
    room.log.append(MEDIATOR, [roll('Mediator · Morale · 3', AT + 3, 'wreck:n2')])
    expect(texts(PLAYER)).toEqual(['Mediator · Morale · 3', 'Mediator · Mech Salvage · 12'])
    room.log.append(PLAYER, [roll('p1 · Core Mechanic · 4', AT + 4, 'wreck:n2')])
    expect(texts(PLAYER)).toHaveLength(3)
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

  test('Reveal sends a private roll to the players: their Feed, the log they read and the bound channel (r3 A1)', () => {
    const { room, act, texts } = seated()
    const full = 'Mediator · Warlord Vex · Rifle · 15 · Success'
    room.log.append(MEDIATOR, [
      {
        entityType: 'game',
        field: 'roll',
        after: { description: full, private: true, veiled: 'Mediator rolled · 15 · Success' },
        source: 'play',
        ts: AT + 1,
      },
    ])
    // Private: a player is served nothing of it, not even its veiled line.
    expect(texts(PLAYER)).toEqual([])
    expect(room.log.rolls(PLAYER)).toEqual([])
    const [own] = room.events.list(MEDIATOR)
    expect(own).toMatchObject({ text: full, private: true, veiled: true })
    const told = act(MEDIATOR, 'changeLog.reveal', { rollId: String(own?._id) }, AT + 2)
    // The room now serves it to everyone whole, no longer private or veiled.
    expect(told).toMatchObject([{ _id: own?._id, kind: 'roll', text: full, revealed: true }])
    expect(told[0]).not.toHaveProperty('private')
    expect(told.filter(isMirrored)).toHaveLength(1)
    expect(room.events.list(PLAYER)).toMatchObject([{ text: full, revealed: true, mediator: true }])
    expect(room.log.rolls(PLAYER).map((r) => r.description)).toEqual([full])
    const [after] = room.events.list(MEDIATOR)
    expect(after).not.toHaveProperty('private')
    expect(after).not.toHaveProperty('veiled')
    expect(room.log.rolls(MEDIATOR)[0]).not.toHaveProperty('private')
    // A second Reveal tells nobody again.
    expect(act(MEDIATOR, 'changeLog.reveal', { rollId: String(own?._id) }, AT + 3)).toEqual([])
  })

  test('a private roll with no names to veil is revealed the same way; a table roll is not one to reveal (r3 A1)', () => {
    const { room, act, texts } = seated()
    const entry = (description: string, extra: object, ts: number) => ({
      entityType: 'game',
      field: 'roll',
      after: { description, ...extra },
      source: 'play',
      ts,
    })
    room.log.append(MEDIATOR, [
      entry('Mediator · Core Mechanic · 13 · Success', { private: true }, AT + 1),
    ])
    room.log.append(MEDIATOR, [entry('Mediator · Core Mechanic · 4 · Failure', {}, AT + 2)])
    const [open, hidden] = room.events.list(MEDIATOR)
    expect(() => act(MEDIATOR, 'changeLog.reveal', { rollId: String(open?._id) })).toThrow(
      'not a roll to reveal'
    )
    act(MEDIATOR, 'changeLog.reveal', { rollId: String(hidden?._id) }, AT + 3)
    expect(texts(PLAYER)).toEqual([
      'Mediator · Core Mechanic · 4 · Failure',
      'Mediator · Core Mechanic · 13 · Success',
    ])
  })

  test('after a hand over the new Mediator reads earlier private rolls under their roller’s name, never as the Mediator’s of today (r3 A2)', () => {
    const { room, act } = seated()
    room.log.append(MEDIATOR, [
      {
        entityType: 'game',
        field: 'roll',
        after: { description: 'Mediator · Warlord Vex · Rifle · 3 · Failure', private: true },
        source: 'play',
        ts: AT + 1,
      },
    ])
    act('d-org', 'setMediator', { userId: PLAYER, mediator: true }, AT + 2)
    act('d-org', 'setMediator', { userId: MEDIATOR, mediator: false }, AT + 3)
    const name = room.store.member(MEDIATOR)?.displayName
    expect(name).toBeTruthy()
    const [crossed] = room.events.list(PLAYER).filter((e) => e.kind === 'roll')
    expect(crossed).toMatchObject({
      text: `${name} · Warlord Vex · Rifle · 3 · Failure`,
      private: true,
      actorId: MEDIATOR,
    })
    expect(crossed).not.toHaveProperty('mediator')
    // Whoever rolled it no longer mediates, so the room serves them nothing of it.
    expect(room.events.list(MEDIATOR).filter((e) => e.kind === 'roll')).toEqual([])
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

  // r5 A3 (LG5-03, MD5-17): the Mediator moved Downtime on and the players heard nothing.
  test('Downtime moving is a line for everyone, naming the step and what was passed over', () => {
    const { act, texts } = seated()
    act(MEDIATOR, 'downtime.begin', undefined as never, AT + 1)
    const [next] = act(MEDIATOR, 'downtime.advance', undefined as never, AT + 2)
    expect(next).toMatchObject({ kind: 'downtime', actorId: MEDIATOR })
    act(MEDIATOR, 'downtime.setStep', { stepIndex: 6 }, AT + 3)
    act(MEDIATOR, 'downtime.setStep', { stepIndex: 2 }, AT + 4)
    // Put on the step it is already on, nothing moved, and nothing is said.
    expect(act(MEDIATOR, 'downtime.setStep', { stepIndex: 2 }, AT + 5)).toEqual([])
    const names = downtimeStepNames()
    expect(texts(PLAYER).slice(0, 3)).toEqual([
      `Mediator moved Downtime back to 3 ${names[2]}`,
      `Mediator moved Downtime to 7 ${names[6]}, past 3–6`,
      `Mediator moved Downtime to 2 ${names[1]}`,
    ])
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
    // By role, as the session's lines are: one screen never has two words for one person (r3 A6).
    expect(texts(PLAYER)).toEqual(['Mediator ended Downtime', 'Mediator began Downtime'])
    expect(isMirrored(began as never)).toBe(true)
  })

  test('an accepted proposal undone says so, on the table’s line and on the Mediator’s row (r3 A5)', () => {
    const { act, room, texts } = seated()
    act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 8 })] }, AT + 1)
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 3 }, AT + 2)
    const pending = room.proposals.pending(PLAYER)[0]
    const [accepted] = act(PLAYER, 'ops.accept', { opId: pending?._id as string }, AT + 3)
    expect(accepted).toMatchObject({ kind: 'proposal', answer: 'accepted' })
    expect(room.proposals.sent(MEDIATOR)[0]?.state).toBe('applied')
    // The player's Undo writes back what the sheet held (`acceptedUndo`).
    const [undone] = act(
      PLAYER,
      'submit',
      {
        ops: [op('p1', { currentHP: 8 }, { baseSeq: 2, kind: 'transaction', source: 'play-undo' })],
      },
      AT + 4
    )
    expect(undone).toMatchObject({
      kind: 'proposal',
      answer: 'undone',
      text: 'Player undid: p1 · Pilot p1 HP → 3',
      actorId: PLAYER,
    })
    expect(room.proposals.sent(MEDIATOR)[0]?.state).toBe('undone')
    expect(texts().slice(0, 2)).toEqual([
      'Player undid: p1 · Pilot p1 HP → 3',
      'Player accepted: p1 · Pilot p1 HP → 3',
    ])
    // A later change is its own: the row stays Undone, and the line is a vital's.
    const [later] = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 6 }, { baseSeq: 3 })] },
      AT + 5
    )
    expect(later).toMatchObject({ kind: 'vitals' })
    expect(room.proposals.sent(MEDIATOR)[0]?.state).toBe('undone')
  })

  test('a heal back to the old value is a heal, never the proposal undone (r5 A2)', () => {
    const { act, room } = seated()
    act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 8 })] }, AT + 1)
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 3 }, AT + 2)
    act(PLAYER, 'ops.accept', { opId: room.proposals.pending(PLAYER)[0]?._id as string }, AT + 3)
    // Change by amount, a repair or Downtime's Restore: Play's own write, back to 8.
    const [healed] = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 8 }, { baseSeq: 2, kind: 'transaction', source: 'play' })] },
      AT + 4
    )
    expect(healed).toMatchObject({ kind: 'vitals', text: 'p1 · Pilot p1 · HP 3 → 8' })
    expect(room.proposals.sent(MEDIATOR)[0]?.state).toBe('applied')
    // A sheet's own Undo of the accepted change is an Undo too.
    const other = seated()
    other.act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 8 })] }, AT + 1)
    other.act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 3 }, AT + 2)
    const sent = other.room.proposals.pending(PLAYER)[0]?._id as string
    other.act(PLAYER, 'ops.accept', { opId: sent }, AT + 3)
    const [undone] = other.act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 8 }, { baseSeq: 2, source: `live-sheet-undo:${sent}` })] },
      AT + 4
    )
    expect(undone).toMatchObject({ kind: 'proposal', answer: 'undone' })
    expect(other.room.proposals.sent(MEDIATOR)[0]?.state).toBe('undone')
  })

  test('an accepted proposal changed to anything but what it replaced still stands', () => {
    const { act, room } = seated()
    act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 8 })] }, AT + 1)
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 3 }, AT + 2)
    act(PLAYER, 'ops.accept', { opId: room.proposals.pending(PLAYER)[0]?._id as string }, AT + 3)
    const [stepped] = act(
      PLAYER,
      'submit',
      { ops: [op('p1', { currentHP: 4 }, { baseSeq: 2 })] },
      AT + 4
    )
    expect(stepped).toMatchObject({ kind: 'vitals' })
    expect(room.proposals.sent(MEDIATOR)[0]?.state).toBe('applied')
  })

  test('a member removed is a line for the table, as their joining was (r3 A4)', () => {
    const { room, texts } = seated()
    const told = room.events.removed('d-org', PLAYER, AT + 1)
    expect(told).toMatchObject({ kind: 'leave', text: 'Player was removed from the Game' })
    expect(isMirrored(told)).toBe(true)
    expect(texts(MEDIATOR)).toEqual(['Player was removed from the Game'])
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

  test('giving the turn is a line for the whole table, once per pilot given it (r5 A4)', () => {
    const { act, texts } = seated()
    const [given] = act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 1)
    expect(given).toMatchObject({ kind: 'turn', actorId: MEDIATOR })
    expect(given?.text).toStartWith('The Mediator gave ')
    expect(given?.text).toEndWith(' the turn')
    expect(isMirrored(given as never)).toBe(true)
    expect(texts(PLAYER)[0]).toBe(given?.text as string)
    // The same pilot again, or nobody, says nothing more.
    expect(act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 2)).toEqual([])
    expect(act(MEDIATOR, 'scenes.setUpNow', { pilotId: null }, AT + 3)).toEqual([])
  })

  test('a resolve nobody applied is closed, not applied, when its turn or the session ends (r5 A7)', () => {
    const { act, room, texts } = seated()
    const open = (name: string) =>
      act(PLAYER, 'seats.setResolving', {
        pilotId: 'p1',
        resolving: {
          ref: 'k',
          name,
          activated: true,
          roll: { roll: 12, band: 'success' },
          applied: false,
        },
      })
    act(MEDIATOR, 'session.start', undefined as never, AT)
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 1)
    open('Chainsaw Arm')
    const ended = act(PLAYER, 'scenes.endTurn', undefined as never, AT + 2)
    expect(ended.map((e) => e.text)).toEqual([
      expect.stringContaining('ended their turn'),
      expect.stringContaining(' · Chainsaw Arm: not applied'),
    ])
    expect(room.play.seat('p1')?.resolving).toBeNull()
    // The turn moved on by the Mediator's hand closes it too.
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 3)
    open('Provoke')
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: null }, AT + 4)
    expect(room.play.seat('p1')?.resolving).toBeNull()
    expect(texts(MEDIATOR)[0]).toContain(' · Provoke: not applied')
    // Downtime beginning ends the turn too.
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 4)
    open('Patch')
    act(MEDIATOR, 'downtime.begin', undefined as never, AT + 4)
    expect(room.play.seat('p1')?.resolving).toBeNull()
    act(MEDIATOR, 'downtime.end', undefined as never, AT + 4)
    // And the session ending closes every seat's.
    open('Red Laser')
    const left = act(MEDIATOR, 'session.end', undefined as never, AT + 5)
    expect(left.map((e) => e.text)).toEqual([
      expect.stringContaining(' · Red Laser: not applied'),
      expect.stringContaining('ended the group session'),
    ])
    expect(room.play.seat('p1')?.resolving).toBeNull()
  })

  test('the player who is up ends their own turn: the marker clears and the table is told (r4 B1)', () => {
    const { act, room, texts } = seated()
    act(MEDIATOR, 'scenes.setUpNow', { pilotId: 'p1' }, AT + 1)
    // Nobody else's turn is theirs to end, the Mediator's included: theirs is the seat's button.
    expect(() => act(MEDIATOR, 'scenes.endTurn', undefined as never, AT + 2)).toThrow(
      'It is not your turn to end'
    )
    const [told] = act(PLAYER, 'scenes.endTurn', undefined as never, AT + 3)
    expect(told).toMatchObject({ kind: 'turn', actorId: PLAYER })
    expect(told?.text).toEndWith('ended their turn')
    expect(room.scene.scene(MEDIATOR)).not.toHaveProperty('upNow')
    expect(texts(MEDIATOR)[0]).toBe(told?.text as string)
    // With nobody up there is no turn to end.
    expect(() => act(PLAYER, 'scenes.endTurn', undefined as never, AT + 4)).toThrow(
      'It is not your turn to end'
    )
  })

  test('an alert is withdrawn by a Mediator: it leaves the stream and a line says so (r4 B4)', () => {
    const { act, room, texts } = seated()
    act(MEDIATOR, 'changeLog.broadcast', { message: 'Reinforcments arive' }, AT + 1)
    const alertId = String(room.log.alerts(PLAYER)[0]?._id)
    expect(() => act(PLAYER, 'changeLog.withdrawAlert', { alertId })).toThrow('Only the Mediator')
    const [told] = act(MEDIATOR, 'changeLog.withdrawAlert', { alertId }, AT + 2)
    expect(told).toMatchObject({ kind: 'withdrawn', text: 'Mediator withdrew an alert' })
    expect(room.log.alerts(PLAYER)).toEqual([])
    expect(texts()).toEqual(['Mediator withdrew an alert'])
    expect(() => act(MEDIATOR, 'changeLog.withdrawAlert', { alertId }, AT + 3)).toThrow(
      'That alert is no longer there'
    )
  })

  test('a salvaged part proposed to a Mech’s hold adds to the hold it holds when accepted (r5 B2)', () => {
    const { act, room, texts } = seated()
    const held = { id: 'l1', kind: 'unit', name: 'Crate', cat: 'SEALED', units: 1, code: 'CRT' }
    act(PLAYER, 'submit', { ops: [op('m1', { cargoLots: [held] })] }, AT)
    const part = {
      id: 'l2',
      kind: 'unit',
      name: 'Mule (Damaged)',
      cat: 'SYSTEM',
      units: 7,
      code: 'MUL',
    }
    act(MEDIATOR, 'ops.propose', { entityId: 'm1', field: 'cargoLots', after: [part] }, AT + 1)
    expect(texts()[0]).toBe('Mediator proposes Mech m1 Cargo → + Mule (Damaged)')
    // The hold changed after the proposal was sent: accepting keeps both.
    const other = { ...held, id: 'l3', name: 'Ration Pack' }
    act(PLAYER, 'submit', { ops: [op('m1', { cargoLots: [held, other] }, { baseSeq: 1 })] }, AT + 2)
    const opId = String(room.proposals.pending(PLAYER)[0]?._id)
    act(PLAYER, 'ops.accept', { opId }, AT + 3)
    const mech = room.units.list(PLAYER).find((u) => u.id === 'm1')
    expect(((mech?.body.cargoLots ?? []) as { name: string }[]).map((l) => l.name)).toEqual([
      'Mule (Damaged)',
      'Crate',
      'Ration Pack',
    ])
    expect(room.proposals.sent(MEDIATOR)[0]).toMatchObject({ state: 'applied', after: [part] })
    expect(() =>
      act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'cargoLots', after: [part] }, AT + 4)
    ).toThrow('Mech')
  })

  test('a sent proposal is withdrawn by a Mediator: it leaves the player’s list and reads Withdrawn (r2 C7)', () => {
    const { act, room, texts } = seated()
    act(PLAYER, 'submit', { ops: [op('p1', { currentHP: 7 })] }, AT)
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 0 }, AT + 1)
    const [pending] = room.proposals.pending(PLAYER)
    // The player's notice says from and to: the sheet as it is now, never stored on the proposal.
    expect(pending).toMatchObject({ field: 'currentHP', current: 7, after: 0 })
    const opId = String(pending?._id)
    expect(() => act(PLAYER, 'ops.withdraw', { opId })).toThrow('Only the Mediator')
    const [told] = act(MEDIATOR, 'ops.withdraw', { opId }, AT + 2)
    expect(told).toMatchObject({
      kind: 'proposal',
      text: 'Mediator withdrew: p1 · Pilot p1 HP → 0',
    })
    expect(room.proposals.pending(PLAYER)).toEqual([])
    expect(room.proposals.sent(MEDIATOR)[0]).toMatchObject({ _id: opId, state: 'withdrawn' })
    // Withdrawn, it can be neither accepted nor withdrawn again.
    expect(() => act(PLAYER, 'ops.accept', { opId }, AT + 3)).toThrow('already been answered')
    expect(act(MEDIATOR, 'ops.withdraw', { opId }, AT + 4)).toEqual([])
    expect(texts()[0]).toBe('Mediator withdrew: p1 · Pilot p1 HP → 0')
  })

  test('a vital never written is proposed from its start (r2 C7)', () => {
    const { act, room } = seated()
    act(MEDIATOR, 'ops.propose', { entityId: 'p1', field: 'currentHP', after: 4 }, AT + 1)
    expect(room.proposals.pending(PLAYER)[0]?.current).toBe(10)
  })
})
