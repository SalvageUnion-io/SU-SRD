import { describe, expect, test } from 'bun:test'
import { AT, bodies, MEDIATOR, ORGANIZER, op, PLAYER, STRANGER, table } from './harness'

function withCrew() {
  const made = table()
  const { room } = made
  room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  return made
}

describe('creating a unit', () => {
  test('a member makes their own pilot; a stranger cannot', () => {
    const { room } = withCrew()
    expect(room.units.list(PLAYER).find((u) => u.id === 'p1')?.ownerId).toBe(PLAYER)
    expect(() =>
      room.units.create(STRANGER, { id: 'p9', kind: 'pilot', body: bodies.pilot('p9'), at: AT })
    ).toThrow('Not a member of this Game')
    expect(room.units.list(STRANGER)).toEqual([])
  })

  test('creating the same id twice lands once', () => {
    const { room } = withCrew()
    room.units.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT + 5 })
    expect(room.units.list(PLAYER).filter((u) => u.id === 'p1')).toHaveLength(1)
  })

  test('a malformed body is a defect, not a unit', () => {
    const { room } = table()
    expect(() =>
      room.units.create(PLAYER, { id: 'p2', kind: 'pilot', body: { callsign: 7 }, at: AT })
    ).toThrow('Invalid pilot payload')
  })

  test('only the table runner raises a crawler, and the first takes the crew aboard', () => {
    const { room } = withCrew()
    expect(() =>
      room.units.create(PLAYER, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    ).toThrow('Only the Mediator')
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    const crawler = room.units.list(MEDIATOR).find((u) => u.id === 'c1')
    expect(crawler?.ownerId).toBeNull()
    expect(room.roster.read(PLAYER)?.crawlerName).toBe('Crawler c1')
    // Both pilot and mech went aboard; a second crawler changes nobody.
    room.units.create(MEDIATOR, {
      id: 'c2',
      kind: 'crawler',
      body: bodies.crawler('c2'),
      at: AT + 1,
    })
    room.units.create(PLAYER, { id: 'p2', kind: 'pilot', body: bodies.pilot('p2'), at: AT + 2 })
    const crew = room.units.links(PLAYER).map((l) => `${l.from.id}>${l.to.id}`)
    expect(crew.sort()).toEqual(['m1>c1', 'p1>c1', 'p2>c1'])
  })
})

describe('writing by ops', () => {
  test('the holder applies an op; the snapshot moves to its seq', () => {
    const { room } = withCrew()
    const result = room.units.submit(PLAYER, [op('p1', { currentHP: 3 })])
    expect(result).toEqual({ ok: true, applied: [{ id: expect.any(String), seq: 1 }] })
    const pilot = room.units.list(PLAYER).find((u) => u.id === 'p1')
    expect(pilot?.body.currentHP).toBe(3)
    expect(pilot?.headSeq).toBe(1)
    room.units.submit(PLAYER, [op('p1', { currentHP: 2 }, { baseSeq: 1 })])
    expect(room.units.history(PLAYER, 'p1')[0]?.before).toEqual({ currentHP: 3 })
  })

  test('sending the same op twice applies it once', () => {
    const { room } = withCrew()
    const once = op('p1', { currentHP: 2 })
    room.units.submit(PLAYER, [once])
    expect(room.units.submit(PLAYER, [once])).toEqual({
      ok: true,
      applied: [{ id: once.id, seq: 1 }],
    })
    expect(room.units.history(PLAYER, 'p1')).toHaveLength(1)
  })

  test('nobody but the holder writes a pilot, not even the Mediator', () => {
    const { room } = withCrew()
    expect(() => room.units.submit(MEDIATOR, [op('p1', { currentHP: 1 })])).toThrow(
      "You cannot edit another player's entity"
    )
  })

  test('a batch lands whole or not at all', () => {
    const { room } = withCrew()
    room.units.submit(PLAYER, [op('p1', { currentHP: 4 })])
    // The second op is from a stale copy of a field the first one moved.
    const result = room.units.submit(PLAYER, [
      op('m1', { currentSP: 2 }),
      op('p1', { currentHP: 1 }, { baseSeq: 0 }),
    ])
    expect(result).toMatchObject({ ok: false, reason: 'conflict', fields: ['currentHP'] })
    expect(room.units.list(PLAYER).find((u) => u.id === 'm1')?.headSeq).toBe(0)
  })

  test('an invalid op is refused with its reason', () => {
    const { room } = withCrew()
    expect(room.units.submit(PLAYER, [op('p1', { invalid: true })])).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
  })

  test('the crawler is the table runner’s, and an outbox replay cannot touch it', () => {
    const { room } = withCrew()
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    expect(() => room.units.submit(PLAYER, [op('c1', { scrap: 3 })])).toThrow('Only the Mediator')
    expect(room.units.submit(MEDIATOR, [op('c1', { scrap: 3 })]).ok).toBe(true)
    expect(() =>
      room.units.submit(MEDIATOR, [op('c1', { scrap: 4 }, { baseSeq: 1 })], { replayed: true })
    ).toThrow('needs a connection')
    expect(room.units.submit(PLAYER, [op('p1', { currentHP: 2 })], { replayed: true }).ok).toBe(
      true
    )
  })
})

describe('proposals', () => {
  test('the Mediator proposes, the holder applies, and a newer proposal supersedes', () => {
    const { room } = withCrew()
    expect(() =>
      room.proposals.propose(PLAYER, {
        id: 'x',
        unitId: 'p1',
        field: 'currentHP',
        value: 1,
        at: AT,
      })
    ).toThrow('Only the Mediator')
    room.proposals.propose(MEDIATOR, {
      id: 'pr1',
      unitId: 'p1',
      field: 'currentHP',
      value: 2,
      at: AT,
    })
    room.proposals.propose(MEDIATOR, {
      id: 'pr2',
      unitId: 'p1',
      field: 'currentHP',
      value: 1,
      reason: '  Rifle volley ',
      at: AT + 1,
    })
    expect(room.proposals.pending(PLAYER).map((p) => [p.id, p.value, p.reason])).toEqual([
      ['pr2', 1, 'Rifle volley'],
    ])
    expect(room.proposals.pending(ORGANIZER)).toEqual([])
    expect(room.proposals.sent(MEDIATOR).map((p) => [p.id, p.state])).toEqual([
      ['pr2', 'proposed'],
      ['pr1', 'superseded'],
    ])
    expect(() => room.proposals.applyProposal(MEDIATOR, 'pr2', AT + 2)).toThrow('Only the owner')
    expect(room.proposals.applyProposal(PLAYER, 'pr2', AT + 2).ok).toBe(true)
    expect(room.units.list(PLAYER).find((u) => u.id === 'p1')?.body.currentHP).toBe(1)
    expect(() => room.proposals.applyProposal(PLAYER, 'pr2', AT + 3)).toThrow(
      'already been answered'
    )
  })

  test('a proposal applies over the holder’s own later edit, and a decline is kept', () => {
    const { room } = withCrew()
    room.proposals.propose(MEDIATOR, {
      id: 'pr1',
      unitId: 'p1',
      field: 'currentHP',
      value: 2,
      at: AT,
    })
    room.units.submit(PLAYER, [op('p1', { currentHP: 5 })])
    expect(room.proposals.applyProposal(PLAYER, 'pr1', AT + 1).ok).toBe(true)
    room.proposals.propose(MEDIATOR, {
      id: 'pr2',
      unitId: 'm1',
      field: 'currentSP',
      value: 1,
      at: AT,
    })
    room.proposals.declineProposal(PLAYER, 'pr2')
    expect(room.proposals.sent(MEDIATOR).find((p) => p.id === 'pr2')?.state).toBe('declined')
  })

  test('an unassigned unit takes no proposal, and a long reason is refused, not cut', () => {
    const { room } = withCrew()
    room.units.unassign(PLAYER, 'p1', AT)
    expect(() =>
      room.proposals.propose(MEDIATOR, {
        id: 'a',
        unitId: 'p1',
        field: 'currentHP',
        value: 1,
        at: AT,
      })
    ).toThrow('unassigned')
    expect(() =>
      room.proposals.propose(MEDIATOR, {
        id: 'b',
        unitId: 'm1',
        field: 'currentSP',
        value: 1,
        reason: 'x'.repeat(141),
        at: AT,
      })
    ).toThrow('at most 140')
  })
})

describe('assignment', () => {
  test('a player takes a free unit; only the table runner reassigns a held one', () => {
    const { room } = withCrew()
    room.units.unassign(PLAYER, 'p1', AT)
    expect(() => room.units.submit(PLAYER, [op('p1', { currentHP: 1 })])).toThrow('unassigned')
    room.units.assign(ORGANIZER, 'p1', AT)
    expect(() => room.units.assign(PLAYER, 'p1', AT)).toThrow('A crewmate already holds that')
    room.units.assign(MEDIATOR, 'p1', AT, PLAYER)
    expect(room.units.list(PLAYER).find((u) => u.id === 'p1')?.ownerId).toBe(PLAYER)
    expect(() => room.units.assign(MEDIATOR, 'p1', AT, STRANGER)).toThrow('not in this Game')
    // Each change of holder is on the unit's log, and moves no body field.
    const log = room.units.history(PLAYER, 'p1').filter((o) => o.source === 'ownership')
    expect(log.map((o) => o.patch.ownerId)).toEqual([PLAYER, ORGANIZER, null])
    expect(room.units.submit(PLAYER, [op('p1', { currentHP: 1 }, { baseSeq: 0 })]).ok).toBe(true)
  })
})

describe('removing', () => {
  test('a mech deleted leaves its boarder on foot, and its links go', () => {
    const { room } = withCrew()
    room.units.drawLink(PLAYER, {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm1' },
      to: { type: 'pilot', id: 'p1' },
    })
    room.play.board(PLAYER, 'p1', 'm1', AT)
    room.units.remove(PLAYER, 'm1')
    expect(room.play.seat('p1')?.mount).toEqual({ kind: 'foot' })
    expect(room.units.history(PLAYER, 'm1')).toEqual([])
  })

  test('scrapping the primary crawler hands primary to the oldest left', () => {
    const { room } = withCrew()
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    room.units.create(MEDIATOR, {
      id: 'c2',
      kind: 'crawler',
      body: bodies.crawler('c2'),
      at: AT + 1,
    })
    expect(() => room.units.remove(PLAYER, 'c1')).toThrow('Only the Mediator')
    room.units.remove(MEDIATOR, 'c1')
    expect(room.roster.read(PLAYER)?.crawlerName).toBe('Crawler c2')
  })
})

describe('links', () => {
  test('a pilot flown by a crewmate’s mech is not taken without them', () => {
    const { room } = withCrew()
    room.units.create(MEDIATOR, { id: 'm2', kind: 'mech', body: bodies.mech('m2'), at: AT })
    room.units.unassign(PLAYER, 'p1', AT)
    room.units.assign(MEDIATOR, 'p1', AT)
    // The Mediator's mech flies the Mediator's pilot p1; the player's mech asks for it.
    room.units.drawLink(MEDIATOR, {
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 'm2' },
      to: { type: 'pilot', id: 'p1' },
    })
    expect(() =>
      room.units.drawLink(PLAYER, {
        type: 'mech-to-pilot',
        from: { type: 'mech', id: 'm1' },
        to: { type: 'pilot', id: 'p1' },
      })
    ).toThrow('That Pilot already flies another Mech')
  })

  test('crew slots are the table runner’s, and need the slot', () => {
    const { room } = withCrew()
    room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
    room.units.create(PLAYER, { id: 'n1', kind: 'npc', body: bodies.npc('n1'), at: AT })
    const crew = {
      type: 'npc-to-crawler' as const,
      from: { type: 'npc' as const, id: 'n1' },
      to: { type: 'crawler' as const, id: 'c1' },
      slot: { kind: 'bay' as const, bayRef: 'no-such-bay' },
    }
    expect(() => room.units.drawLink(PLAYER, crew)).toThrow('Only whoever runs the table')
    expect(() => room.units.drawLink(MEDIATOR, crew)).toThrow('no such crew slot')
  })

  test('an end that is not in this Game is refused', () => {
    const { room } = withCrew()
    expect(() =>
      room.units.drawLink(PLAYER, {
        type: 'mech-to-pilot',
        from: { type: 'mech', id: 'm1' },
        to: { type: 'pilot', id: 'elsewhere' },
      })
    ).toThrow('different places')
  })
})
