/**
 * The crew picks a wreck's part (r7 D8, ADR-030 §4 as amended): the
 * Mediator's Mech Salvage pick goes to the table as a proposal on the
 * crawler, which any member of the crew may accept, change or decline.
 */
import { describe, expect, test } from 'bun:test'
import type { SalvageOffer } from 'game-domain/games/proposals'
import { CARGO_PROPOSAL_FIELD } from 'game-domain/games/proposals'
import type { GameActArgs, GameActName } from '../acts'
import { runAct } from '../acts'
import { AT, bodies, MEDIATOR, ORGANIZER, PLAYER, STRANGER, table } from './harness'

const OFFER: SalvageOffer = {
  band: 'bits',
  parts: [
    { key: 'chassis', kind: 'chassis', name: 'Bobcat', techLevel: 1, salvageValue: 3 },
    { key: 'system:0', kind: 'system', name: 'Mining Rig', techLevel: 1, salvageValue: 1 },
    { key: 'module:0', kind: 'module', name: 'Ammo Feed', techLevel: 2, salvageValue: 2 },
  ],
  picked: ['system:0'],
}

const lot = (name: string) => ({
  id: `lot-${name}`,
  kind: 'unit' as const,
  name: `${name} (Damaged)`,
  cat: 'SYSTEM',
  units: 1,
  tl: 1,
})

function crew() {
  const made = table()
  const { room, gameId } = made
  room.units.create(PLAYER, { id: 'm1', kind: 'mech', body: bodies.mech('m1'), at: AT })
  room.units.create(MEDIATOR, { id: 'c1', kind: 'crawler', body: bodies.crawler('c1'), at: AT })
  const offer = (over: Partial<SalvageOffer> = {}, unitId = 'c1', id = 's1') =>
    room.proposals.propose(MEDIATOR, {
      id,
      unitId,
      field: CARGO_PROPOSAL_FIELD,
      value: [lot('Mining Rig')],
      reason: 'Mech Salvage',
      offer: { ...OFFER, ...over },
      at: AT,
    })
  const act = <N extends GameActName>(actor: string, name: N, args: GameActArgs<N>, at = AT) => {
    const before = room.events.before(name, args)
    const answer = runAct({ room, actor, gameId, at }, name, args)
    if (!answer.ok) throw new Error(answer.refusal)
    return room.events.after(actor, name, args, answer.value, before, at)
  }
  const hold = (id = 'c1') =>
    ((room.store.unit(id)?.body.cargoLots ?? []) as { name: string }[]).map((l) => l.name)
  return { ...made, offer, act, hold }
}

describe('a wreck’s salvage offered to the crew (r7 D8)', () => {
  test('waits on every member but the Mediator who offered it, with its choices', () => {
    const { room, offer } = crew()
    offer()
    const [mine] = room.proposals.pending(PLAYER)
    expect(mine).toMatchObject({ _id: 's1', entityId: 'c1', entityType: 'crawler' })
    expect(mine?.offer).toEqual(OFFER)
    expect(room.proposals.pending(ORGANIZER).map((p) => p._id)).toEqual(['s1'])
    expect(room.proposals.pending(MEDIATOR)).toEqual([])
    expect(room.proposals.pending(STRANGER)).toEqual([])
  })

  test('a crawler takes no proposal but a salvage offer, and only a pick the band allows', () => {
    const { room, offer } = crew()
    expect(() =>
      room.proposals.propose(MEDIATOR, {
        id: 'x',
        unitId: 'c1',
        field: CARGO_PROPOSAL_FIELD,
        value: [lot('Mining Rig')],
        at: AT,
      })
    ).toThrow('Only a Pilot or a Mech')
    // Bits and Pieces: one System or Module, never the Chassis.
    expect(() => offer({ picked: ['chassis'] })).toThrow('That pick is not one the roll allows')
    expect(() => offer({ picked: ['nope'] })).toThrow('That pick is not one the roll allows')
  })

  test('any crewmate accepts it, and the part goes into the crawler’s hold', () => {
    const { room, offer, hold } = crew()
    offer()
    expect(room.proposals.applyProposal(ORGANIZER, 's1', AT + 1).ok).toBe(true)
    expect(hold()).toEqual(['Mining Rig (Damaged)'])
    expect(room.proposals.pending(PLAYER)).toEqual([])
    expect(() => room.proposals.applyProposal(PLAYER, 's1', AT + 2)).toThrow(
      'already been answered'
    )
  })

  test('a crewmate changes the pick: the part they chose goes in, the offer reads superseded', () => {
    const { room, offer, hold } = crew()
    offer()
    expect(() => room.proposals.applyProposal(PLAYER, 's1', AT + 1, ['chassis'])).toThrow(
      'That pick is not one the roll allows'
    )
    expect(room.proposals.applyProposal(PLAYER, 's1', AT + 1, ['module:0']).ok).toBe(true)
    expect(hold()).toEqual(['Ammo Feed (Damaged)'])
    const sent = room.proposals.sent(MEDIATOR).map((p) => [p._id, p.state])
    expect(sent).toContainEqual(['s1', 'superseded'])
    expect(sent).toContainEqual(['s1:picked', 'applied'])
  })

  test('any crewmate may decline it; a stranger may not', () => {
    const { room, offer, hold } = crew()
    offer()
    expect(() => room.proposals.declineProposal(STRANGER, 's1')).toThrow()
    room.proposals.declineProposal(PLAYER, 's1')
    expect(room.proposals.sent(MEDIATOR).find((p) => p._id === 's1')?.state).toBe('declined')
    expect(hold()).toEqual([])
  })

  test('offered to one crew Mech, it is still its holder’s alone to answer', () => {
    const { room, offer, hold } = crew()
    offer({}, 'm1', 's2')
    expect(room.proposals.pending(ORGANIZER)).toEqual([])
    expect(() => room.proposals.applyProposal(ORGANIZER, 's2', AT + 1)).toThrow('Only the owner')
    expect(room.proposals.applyProposal(PLAYER, 's2', AT + 1, ['module:0']).ok).toBe(true)
    expect(hold('m1')).toEqual(['Ammo Feed (Damaged)'])
  })

  test('the Feed says who took the crew’s pick, and what they chose instead', () => {
    const { act, offer } = crew()
    offer()
    const [line] = act(PLAYER, 'ops.accept', { opId: 's1', picked: ['module:0'] }, AT + 1)
    expect(line?.text).toBe('Player chose instead: Crawler c1 Cargo → + Ammo Feed (Damaged)')
  })
})
