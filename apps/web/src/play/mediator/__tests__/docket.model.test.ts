import { describe, expect, test } from 'bun:test'
import { docketOf } from '../docket.model'
import type { TrayNpc } from '../opposition.model'
import type { SentProposal } from '../proposalLine.model'
import { TABLE_CREW } from './tableFixture'

const npc = (id: string, name: string, over: Partial<TrayNpc> = {}) =>
  ({
    id,
    name,
    down: false,
    group: null,
    refSchema: 'npcs',
    currentHp: 6,
    maxHp: 6,
    lastRoll: null,
    ...over,
  }) as TrayNpc

const sent = (id: string, state: SentProposal['state']) =>
  ({
    _id: id,
    targetName: 'Judge',
    field: 'currentHP',
    after: 2,
    reason: null,
    state,
    mine: true,
    actorName: null,
  }) as SentProposal

const seats = [
  { pilotId: 'pickle', name: 'Pickle' },
  { pilotId: 'judge', name: 'Judge' },
]

describe("the Mediator's Docket (ADR-068 §5)", () => {
  test('Morale due, To act, Awaiting answer, a Heat Check owed and an ask, in that order', () => {
    const tickets = docketOf({
      npcs: [
        npc('n1', 'Raider', { currentHp: 2, refSchema: 'creatures' }),
        npc('n2', 'Hauler'),
        npc('n3', 'Wreck', { down: true }),
      ],
      acted: ['n2'],
      sent: [sent('o1', 'proposed'), sent('o2', 'applied')],
      crew: TABLE_CREW,
      seats,
      asks: [{ pilotId: 'judge', table: 'Core Mechanic' }],
      grouping: true,
    })
    expect(tickets.map((t) => t.kind)).toEqual(['morale', 'toAct', 'awaiting', 'owes', 'asked'])
    expect(tickets[0]).toMatchObject({ name: 'Raider', npcId: 'n1' })
    expect(tickets[1]).toMatchObject({ name: 'Raider', npcId: 'n1' })
    expect(tickets[3]).toMatchObject({ seat: 'Pickle' })
    expect(tickets[4]).toMatchObject({ seat: 'Judge', table: 'Core Mechanic' })
  })

  test('nothing waiting is an empty Docket; no Morale without the encounter sheet, no To act without rounds', () => {
    const tickets = docketOf({
      npcs: [npc('n1', 'Raider', { currentHp: 2, refSchema: 'creatures' })],
      acted: null,
      sent: [],
      crew: null,
      seats: [],
      asks: [],
      grouping: false,
    })
    expect(tickets).toEqual([])
  })
})
